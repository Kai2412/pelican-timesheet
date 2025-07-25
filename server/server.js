require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');
const { OAuth2Client } = require('google-auth-library');
const sql = require('mssql');

// Load client configuration settings
const clientSettings = require('../config/client-settings');

const app = express();

// Security Headers Middleware
app.use((req, res, next) => {
  // Security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Remove server info
  res.removeHeader('X-Powered-By');
  
  next();
});

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: clientSettings.security?.rateLimits?.general || 100,
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: clientSettings.security?.rateLimits?.auth || 5,
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const submitLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: clientSettings.security?.rateLimits?.submissions || 20,
  message: {
    success: false,
    message: 'Too many submissions, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting to all API routes
app.use('/api/', apiLimiter);

// CORS configuration with security enhancements
const allowedOrigins = [
  ...(clientSettings.security?.allowedOrigins || [
    'https://your-app-name.fly.dev',
    'https://your-domain.com'
  ]),
  // Development origins - more permissive for local development
  ...(process.env.NODE_ENV === 'development' ? [
    'http://localhost:3000',
    'http://localhost:3001', 
    'http://localhost:5000',
    'http://localhost:5001',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001',
    'http://127.0.0.1:5000',
    'http://127.0.0.1:5001'
  ] : [])
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow all origins in development for easy testing
    if (process.env.NODE_ENV === 'development') {
      return callback(null, true);
    }
    
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) {
      return callback(null, true);
    }
    
    // In production, check against allowlist
    if (allowedOrigins.indexOf(origin) !== -1) {
      return callback(null, true);
    } else {
      return callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  maxAge: 86400 // 24 hours
}));

// Body parsing with size limits
app.use(express.json({ 
  limit: '10mb',
  verify: (req, res, buf) => {
    // Store raw body for webhook validation if needed
    req.rawBody = buf;
  }
}));

// Input sanitization helper
const sanitizeInput = (input) => {
  if (typeof input !== 'string') return input;
  
  // Remove potentially dangerous characters
  return input
    .replace(/[<>]/g, '') // Remove HTML tags
    .replace(/['"]/g, '') // Remove quotes to prevent injection
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+\s*=/gi, '') // Remove event handlers
    .trim();
};

// Input validation helpers
const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const validateDate = (date) => {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  return dateRegex.test(date) && !isNaN(Date.parse(date));
};

const validateHours = (hours) => {
  const numHours = parseFloat(hours);
  const maxHours = clientSettings.security?.validation?.maxHoursPerEntry || 24;
  return !isNaN(numHours) && numHours >= 0 && numHours <= maxHours;
};

const validateCommunityId = (id) => {
  return typeof id === 'string' && id.length > 0 && id.length <= 50;
};

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const originalSend = res.send;
  
  res.send = function(data) {
    const duration = Date.now() - start;
    const logData = {
      timestamp: new Date().toISOString(),
      method: req.method,
      url: req.url,
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent'),
      status: res.statusCode,
      duration: `${duration}ms`,
      contentLength: res.get('Content-Length') || 0
    };
    
    // Log security-relevant events
    if (req.url.includes('/api/') && (res.statusCode >= 400 || req.method !== 'GET')) {
      console.log('API Request:', JSON.stringify(logData, null, 2));
    }
    
    return originalSend.call(this, data);
  };
  
  next();
});

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Database configuration
const dbConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  options: {
    encrypt: true,
    trustServerCertificate: false
  }
};

// Connect to database
async function connectToDatabase() {
  try {
    console.log('Connecting to database...');
    
    // Close any existing connections
    try {
      await sql.close();
    } catch (err) {
      // Ignore errors from closing
    }
    
    // Connect with config object
    await sql.connect(dbConfig);
    
    console.log('Connected to SQL Server successfully!');
    
    // Test query to verify connection
    const result = await sql.query`SELECT TOP 1 * FROM sys.objects`;
    console.log('Test query successful');
    
    return true;
  } catch (err) {
    console.error('Database connection failed:', err);
    if (err.originalError) {
      console.error('Original error:', err.originalError.message);
    }
    return false;
  }
}

// Enhanced authentication middleware
const verifyGoogleToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required - Bearer token missing'
    });
  }
  
  const token = authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required - Token missing'
    });
  }
  
  try {
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID
    });
    
    const payload = ticket.getPayload();
    
    // Enhanced user validation
    if (!payload.email || !payload.email_verified) {
      return res.status(401).json({
        success: false,
        message: 'Email not verified'
      });
    }
    
    // Check for required claims
    if (!payload.sub || !payload.aud || !payload.iss) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token claims'
      });
    }
    
    // Store user info for use in route handlers
    req.user = {
      id: payload.sub,
      email: payload.email,
      name: payload.name || payload.email.split('@')[0],
      picture: payload.picture,
      verified: payload.email_verified
    };
    
    // Log successful authentication
    console.log(`User authenticated: ${req.user.email} (${req.user.id})`);
    
    next();
  } catch (error) {
    console.error('Token verification failed:', error);
    return res.status(401).json({
      success: false,
      message: 'Invalid authentication token'
    });
  }
};

// Authorization middleware for admin endpoints
const requireAdmin = async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }
  
  try {
    // Check if user has admin privileges
    const result = await sql.query`
      SELECT COUNT(*) as count 
      FROM dbo.vw_PropertyStaffDirectory 
      WHERE email_address = ${req.user.email} 
      AND user_role_id = 1
    `;
    
    const isAdmin = result.recordset[0].count > 0;
    
    if (!isAdmin) {
      console.warn(`Admin access denied for user: ${req.user.email}`);
      return res.status(403).json({
        success: false,
        message: 'Admin privileges required'
      });
    }
    
    console.log(`Admin access granted for user: ${req.user.email}`);
    next();
  } catch (error) {
    console.error('Error checking admin privileges:', error);
    return res.status(500).json({
      success: false,
      message: 'Error verifying admin privileges'
    });
  }
};

// Authorization middleware for role-based access
const requireRole = (allowedRoles = []) => {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }
    
    try {
      // Get user's roles
      const result = await sql.query`
        SELECT DISTINCT user_role_id 
        FROM dbo.vw_PropertyStaffDirectory 
        WHERE email_address = ${req.user.email}
      `;
      
      const userRoles = result.recordset.map(row => row.user_role_id);
      
      // Check if user has any of the required roles
      const hasRequiredRole = allowedRoles.some(role => userRoles.includes(role));
      
      if (!hasRequiredRole) {
        console.warn(`Access denied for user: ${req.user.email}. Required roles: ${allowedRoles}, User roles: ${userRoles}`);
        return res.status(403).json({
          success: false,
          message: 'Insufficient privileges'
        });
      }
      
      // Store user roles for use in route handlers
      req.userRoles = userRoles;
      
      next();
    } catch (error) {
      console.error('Error checking user roles:', error);
      return res.status(500).json({
        success: false,
        message: 'Error verifying user privileges'
      });
    }
  };
};

// Conditional authentication middleware
const conditionalAuth = (req, res, next) => {
  if (clientSettings.security?.strictAuth === false) {
    // Skip authentication if disabled in config
    console.log('Authentication disabled in config - skipping token verification');
    return next();
  }
  
  // Use full authentication
  return verifyGoogleToken(req, res, next);
};

// Conditional role-based access
const conditionalRole = (allowedRoles = []) => {
  return (req, res, next) => {
    if (clientSettings.security?.strictAuth === false) {
      // Skip role checking if authentication is disabled
      return next();
    }
    
    // Use full role checking
    return requireRole(allowedRoles)(req, res, next);
  };
};

// Conditional admin access
const conditionalAdmin = (req, res, next) => {
  if (clientSettings.security?.strictAuth === false) {
    // Skip admin checking if authentication is disabled
    return next();
  }
  
  // Use full admin checking
  return requireAdmin(req, res, next);
};

// Helper function to get property name mapping
async function getPropertyNameMap() {
  try {
    const propertyNamesQuery = await sql.query`
      SELECT DISTINCT property_id, property_name
      FROM dbo.vw_PropertyStaffDirectory
    `;
    
    const propertyMap = {};
    propertyNamesQuery.recordset.forEach(record => {
      propertyMap[record.property_id] = record.property_name;
    });
    
    return propertyMap;
  } catch (error) {
    console.error('Error fetching property names:', error);
    return {};
  }
}

// =============================================
// Regular user endpoints
// =============================================




// Endpoint to fetch communities for the logged-in user
app.get('/api/user-communities', conditionalAuth, async (req, res) => {
  try {
    // Get email from authenticated user or query param (fallback for disabled auth)
    const userEmail = req.user?.email || req.query.email;
    
    if (!userEmail) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }
    
    // Allow admin override through query param (must be authenticated admin)
    const useAdminOverride = req.query.adminOverride === 'true';
    
    if (useAdminOverride) {
      // Verify admin privileges
      const adminCheck = await sql.query`
        SELECT COUNT(*) as count 
        FROM dbo.vw_PropertyStaffDirectory 
        WHERE email_address = ${userEmail} 
        AND user_role_id = 1
      `;
      
      if (adminCheck.recordset[0].count === 0) {
        return res.status(403).json({
          success: false,
          message: 'Admin privileges required for override'
        });
      }
    }
    
    let result;
    
    if (useAdminOverride) {
      // Admin override - get all properties (no role info needed)
      result = await sql.query`
        SELECT DISTINCT property_id as ID, property_name as Name 
        FROM dbo.vw_PropertyStaffDirectory
        ORDER BY property_name
      `;
    } else {
      // Get properties with role information based on authenticated user
      result = await sql.query`
        SELECT property_id as ID, property_name as Name, user_role_id as userRoleId
        FROM dbo.vw_PropertyStaffDirectory
        WHERE email_address = ${userEmail}
        ORDER BY property_name
      `;
    }
    
    let communities, availableRoles = [], redirectToAdmin = false;
    
    if (useAdminOverride) {
      // Admin override - simple format without role info
      communities = result.recordset.map(item => ({
        ID: item.ID,
        Name: item.Name,
        DisplayName: item.Name
      }));
    } else {
      // Regular user - include role info and validate roles
      communities = result.recordset.map(item => ({
        ID: item.ID,
        Name: item.Name,
        DisplayName: item.Name,
        userRoleId: item.userRoleId
      }));
      
      // Get unique roles for this user
      availableRoles = [...new Set(communities.map(c => c.userRoleId))];
      
      // Filter to only valid roles (2=Accountant, 3=Manager)
      const validRoles = availableRoles.filter(role => [2, 3].includes(role));
      
      // If no valid roles, redirect to admin panel
      if (validRoles.length === 0) {
        console.log(`User ${userEmail} has no valid roles, redirecting to admin panel`);
        redirectToAdmin = true;
        communities = [];
        availableRoles = [];
      } else {
        availableRoles = validRoles;
      }
    }
    
    res.json({ 
      communities,
      availableRoles,
      redirectToAdmin,
      questionsRequired: clientSettings.questionsRequired
    });
  } catch (error) {
    console.error('Error fetching communities:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error', 
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Submit time entries endpoint
app.post('/api/submit-time', submitLimiter, conditionalAuth, conditionalRole([2, 3]), async (req, res) => {
  console.log('=== START TIME ENTRY SUBMISSION ===');
  try {
    // Enhanced input validation
    const { date, entries, userId } = req.body;
    
    // Get userId from authenticated user or request body (fallback for disabled auth)
    const submissionUserId = req.user?.email || userId;
    
    if (!submissionUserId) {
      return res.status(400).json({ 
        success: false, 
        message: 'User ID is required' 
      });
    }
    
    // Validate required fields
    if (!date || !validateDate(date)) {
      console.error('Invalid date format:', date);
      return res.status(400).json({ 
        success: false, 
        message: 'Valid date in YYYY-MM-DD format is required' 
      });
    }
    
    if (!entries || !Array.isArray(entries) || entries.length === 0) {
      console.error('Missing or invalid entries array');
      return res.status(400).json({ 
        success: false, 
        message: 'Entries must be a non-empty array' 
      });
    }
    
    // Validate entries limit
    const maxEntries = clientSettings.security?.validation?.maxEntriesPerSubmission || 20;
    if (entries.length > maxEntries) {
      console.error('Too many entries:', entries.length);
      return res.status(400).json({ 
        success: false, 
        message: `Maximum ${maxEntries} entries allowed per submission` 
      });
    }
    
    // Validate each entry
    for (const [index, entry] of entries.entries()) {
      const { communityId, hours, notes } = entry;
      
      if (!communityId || !validateCommunityId(communityId)) {
        return res.status(400).json({ 
          success: false, 
          message: `Invalid community ID in entry ${index + 1}` 
        });
      }
      
      if (hours === undefined || hours === null || !validateHours(hours)) {
        return res.status(400).json({ 
          success: false, 
          message: `Invalid hours value in entry ${index + 1}. Must be between 0 and 24.` 
        });
      }
      
      const maxNoteLength = clientSettings.security?.validation?.maxNoteLength || 500;
      if (notes && notes.length > maxNoteLength) {
        return res.status(400).json({ 
          success: false, 
          message: `Notes too long in entry ${index + 1}. Maximum ${maxNoteLength} characters.` 
        });
      }        
        // Verify user has access to this community (skip if auth disabled)
        if (clientSettings.security?.strictAuth !== false) {
          const accessCheck = await sql.query`
            SELECT COUNT(*) as count 
            FROM dbo.vw_PropertyStaffDirectory 
            WHERE email_address = ${submissionUserId} 
            AND property_id = ${communityId}
          `;
          
          if (accessCheck.recordset[0].count === 0) {
            console.warn(`Access denied for user ${submissionUserId} to community ${communityId}`);
            return res.status(403).json({ 
              success: false, 
              message: `Access denied for community in entry ${index + 1}` 
            });
          }
        }
    }      console.log(`Processing ${entries.length} validated time entries for user ${submissionUserId}`);
    
    // Generate submission timestamp
    const submissionDate = new Date().toISOString();
    console.log(`Submission timestamp: ${submissionDate}`);
    
    // Begin transaction
    console.log('Beginning database transaction');
    const transaction = new sql.Transaction();
    await transaction.begin();
    
    try {
      // For each time entry, insert a record
      for (const entry of entries) {
        const { communityId, hours, notes } = entry;
        
        // Sanitize inputs
        const sanitizedNotes = sanitizeInput(notes || '');
        
        console.log(`Processing entry: communityId=${communityId}, hours=${hours}, notes=${sanitizedNotes || 'N/A'}`);
        
        // Convert types to ensure they match SQL expectations
        const propertyId = String(communityId);
        const hoursValue = String(hours);
        
        // For troubleshooting: log what we're going to insert
        console.log('Inserting record with values:', {
          property_id: propertyId,
          user_name: submissionUserId.split('@')[0],
          email_address: submissionUserId,
          date: date,
          hours: hoursValue,
          notes: sanitizedNotes,
          submission_date: submissionDate
        });
        
        try {
          // Use parameterized query with sql.Request input method
          const ps = new sql.PreparedStatement(transaction);
          ps.input('propertyId', sql.NVarChar);
          ps.input('userName', sql.NVarChar);
          ps.input('email', sql.NVarChar);
          ps.input('date', sql.NVarChar);
          ps.input('hours', sql.NVarChar);
          ps.input('notes', sql.NVarChar);
          ps.input('submissionDate', sql.NVarChar);
          
          await ps.prepare(`
            INSERT INTO dbo.PropertyTime (
              property_id,
              user_name,
              email_address,
              date,
              hours,
              notes,
              submission_date
            ) 
            VALUES (
              @propertyId,
              @userName,
              @email,
              @date,
              @hours,
              @notes,
              @submissionDate
            )
          `);
          
          await ps.execute({
            propertyId,
            userName: submissionUserId.split('@')[0],
            email: submissionUserId,
            date: date,
            hours: hoursValue,
            notes: sanitizedNotes,
            submissionDate: submissionDate
          });
          
          await ps.unprepare();
          
          console.log(`✅ Successfully inserted record for property ${propertyId}`);
        } catch (insertError) {
          console.error(`❌ Error inserting record for property ${propertyId}:`, insertError);
          throw insertError;
        }
      }
      
      // Commit transaction
      await transaction.commit();
      console.log('✅ Transaction committed successfully');
      
      res.json({ 
        success: true, 
        message: `Successfully submitted ${entries.length} time entries`,
        submissionDate: submissionDate
      });
      
    } catch (transactionError) {
      // Rollback transaction on error
      console.error('❌ Transaction error, rolling back:', transactionError);
      await transaction.rollback();
      throw transactionError;
    }
    
  } catch (error) {
    console.error('=== ERROR IN TIME ENTRY SUBMISSION ===');
    console.error('Error details:', error);
    
    res.status(500).json({ 
      success: false, 
      message: 'Failed to submit time entries',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
  
  console.log('=== END TIME ENTRY SUBMISSION ===');
});

// Submit assessment endpoint
app.post('/api/submit-assessment', authLimiter, conditionalAuth, conditionalRole([2, 3]), async (req, res) => {
  console.log('=== START ASSESSMENT SUBMISSION ===');
  try {
    console.log('Received assessment data:', JSON.stringify(req.body, null, 2));
    
    const { userEmail, userName, month, year, submissionType, entries } = req.body;
    
    // Validate required fields
    if (!userEmail) {
      console.error('Missing userEmail in request');
      return res.status(400).json({ success: false, message: 'userEmail is required' });
    }
    
    if (!userName) {
      console.error('Missing userName in request');
      return res.status(400).json({ success: false, message: 'userName is required' });
    }
    
    if (!month || !year) {
      console.error('Missing month or year in request');
      return res.status(400).json({ success: false, message: 'month and year are required' });
    }
    
    if (!submissionType) {
      console.error('Missing submissionType in request');
      return res.status(400).json({ success: false, message: 'submissionType is required' });
    }
    
    if (!entries || !Array.isArray(entries) || entries.length === 0) {
      console.error('Missing or invalid entries array');
      return res.status(400).json({ success: false, message: 'entries must be a non-empty array' });
    }
    
    console.log(`Processing ${entries.length} assessment entries for user ${userEmail}`);
    
    // Generate submission timestamp
    const submissionDate = new Date().toLocaleString();
    console.log(`Submission timestamp: ${submissionDate}`);
    
    // Begin transaction
    console.log('Beginning database transaction');
    const transaction = new sql.Transaction();
    await transaction.begin();
    
    try {
      // For each assessment entry, insert a record
      for (const entry of entries) {
        const { communityId, responses, otherText, timePercentage } = entry;
        console.log(`Processing entry: communityId=${communityId}, timePercentage=${timePercentage}%`);
        
        if (!communityId) {
          throw new Error('Missing communityId in entry');
        }
        
        if (timePercentage === undefined || timePercentage === null) {
          throw new Error('Missing timePercentage in entry');
        }
        
        // Prepare question responses based on submission type
        let cq1, cq2, cq3, cq4, cq5, cq5_other, aq1, aq2, aq3, aq4, aq5, aq5_other;
        
        if (submissionType === 'Manager') {
          cq1 = responses[0] || null;
          cq2 = responses[1] || null;
          cq3 = responses[2] || null;
          cq4 = responses[3] || null;
          cq5 = responses[4] || null;
          cq5_other = otherText || null;
          aq1 = aq2 = aq3 = aq4 = aq5 = aq5_other = null;
        } else if (submissionType === 'Accounting') {
          aq1 = responses[0] || null;
          aq2 = responses[1] || null;
          aq3 = responses[2] || null;
          aq4 = responses[3] || null;
          aq5 = responses[4] || null;
          aq5_other = otherText || null;
          cq1 = cq2 = cq3 = cq4 = cq5 = cq5_other = null;
        }
        
        // For troubleshooting: log what we're going to insert
        console.log('Inserting assessment record with values:', {
          property_id: communityId,
          user_name: userName,
          email_address: userEmail,
          month: month,
          year: year,
          submission_type: submissionType,
          time_percentage: timePercentage,
          submission_date: submissionDate
        });
        
        try {
          // Use parameterized query with sql.Request input method
          const ps = new sql.PreparedStatement(transaction);
          ps.input('propertyId', sql.Int);
          ps.input('userName', sql.NVarChar);
          ps.input('email', sql.NVarChar);
          ps.input('month', sql.Int);
          ps.input('year', sql.Int);
          ps.input('submissionType', sql.NVarChar);
          ps.input('cq1', sql.Int);
          ps.input('cq2', sql.Int);
          ps.input('cq3', sql.Int);
          ps.input('cq4', sql.Int);
          ps.input('cq5', sql.Int);
          ps.input('cq5_other', sql.NVarChar);
          ps.input('aq1', sql.Int);
          ps.input('aq2', sql.Int);
          ps.input('aq3', sql.Int);
          ps.input('aq4', sql.Int);
          ps.input('aq5', sql.Int);
          ps.input('aq5_other', sql.NVarChar);
          ps.input('timePercentage', sql.Int);
          ps.input('submissionDate', sql.NVarChar);
          ps.input('notes', sql.NVarChar);
          
          await ps.prepare(`
            INSERT INTO dbo.PropertyTime (
              property_id,
              user_name,
              email_address,
              month,
              year,
              submission_type,
              cq1,
              cq2,
              cq3,
              cq4,
              cq5,
              cq5_other,
              aq1,
              aq2,
              aq3,
              aq4,
              aq5,
              aq5_other,
              time_percentage,
              submission_date,
              notes
            ) 
            VALUES (
              @propertyId,
              @userName,
              @email,
              @month,
              @year,
              @submissionType,
              @cq1,
              @cq2,
              @cq3,
              @cq4,
              @cq5,
              @cq5_other,
              @aq1,
              @aq2,
              @aq3,
              @aq4,
              @aq5,
              @aq5_other,
              @timePercentage,
              @submissionDate,
              @notes
            )
          `);
          
          await ps.execute({
            propertyId: parseInt(communityId),
            userName: userName,
            email: userEmail,
            month: parseInt(month),
            year: parseInt(year),
            submissionType: submissionType,
            cq1: cq1,
            cq2: cq2,
            cq3: cq3,
            cq4: cq4,
            cq5: cq5,
            cq5_other: cq5_other,
            aq1: aq1,
            aq2: aq2,
            aq3: aq3,
            aq4: aq4,
            aq5: aq5,
            aq5_other: aq5_other,
            timePercentage: parseInt(timePercentage),
            submissionDate: submissionDate,
            notes: '' // Empty notes for now
          });
          
          await ps.unprepare();
          
          console.log(`Successfully inserted assessment entry for property ${communityId} with ${timePercentage}% allocation`);
        } catch (insertError) {
          console.error('Error during specific insert:', insertError);
          throw insertError;
        }
      }
      
      // Commit the transaction
      console.log('All assessment inserts successful, committing transaction');
      await transaction.commit();
      
      console.log('Assessment transaction committed successfully');
      res.json({ 
        success: true, 
        message: 'Assessment submitted successfully',
        count: entries.length,
        submissionDate: submissionDate
      });
      
    } catch (txError) {
      // If there's an error, roll back the transaction
      console.error('Assessment transaction error:', txError);
      if (txError.originalError) {
        console.error('Original error details:', txError.originalError);
      }
      console.log('Rolling back assessment transaction due to error');
      await transaction.rollback();
      throw txError;
    }
    
  } catch (error) {
    console.error('Error in submit-assessment endpoint:', error);
    if (error.originalError) {
      console.error('Original SQL error:', error.originalError);
    }
    res.status(500).json({ 
      success: false, 
      message: 'Failed to submit assessment',
      error: error.message
    });
  } finally {
    console.log('=== END ASSESSMENT SUBMISSION ===');
  }
});

// User dashboard endpoint - shows only communities this user manages
app.get('/api/my-communities', conditionalAuth, async (req, res) => {
  try {
    const email = req.user?.email || req.query.email; // Get from authenticated user or query param
    
    if (!email) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email is required' 
      });
    }
    const month = parseInt(req.query.month) || new Date().getMonth() + 1;
    const year = parseInt(req.query.year) || new Date().getFullYear();
    
    // Validate month and year
    if (month < 1 || month > 12) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid month. Must be between 1 and 12.' 
      });
    }
    
    if (year < 2000 || year > new Date().getFullYear() + 1) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid year' 
      });
    }
    
    console.log(`Fetching my communities dashboard for authenticated user ${email} for ${month}/${year}`);
    
    // First get the communities this user manages
    const userCommunitiesQuery = await sql.query`
      SELECT DISTINCT property_id
      FROM dbo.vw_PropertyStaffDirectory
      WHERE email_address = ${email}
    `;
    
    // Create a set of property IDs managed by this user
    const userCommunities = new Set();
    userCommunitiesQuery.recordset.forEach(record => {
      userCommunities.add(record.property_id);
    });
    
    // Convert set to array for SQL query
    const communityArray = Array.from(userCommunities);
    
    // If user doesn't manage any communities, return empty results
    if (communityArray.length === 0) {
      return res.json({
        success: true,
        summaryStats: {
          totalHours: 0,
          communityCount: 0,
          latestEntryDate: null
        },
        entries: [],
        communityBreakdown: {}
      });
    }
    
    // Get entries for the communities this user manages
    let enhancedEntries = [];
    
    // Use dynamic SQL to handle the IN clause with the array of properties
    const query = `
      SELECT 
        property_id,
        user_name,
        email_address,
        date,
        hours,
        notes
      FROM dbo.PropertyTime
      WHERE 
        property_id IN (${communityArray.map(id => `'${id}'`).join(',')})
        AND MONTH(date) = ${month}
        AND YEAR(date) = ${year}
      ORDER BY date DESC
    `;
    
    const result = await sql.query(query);
    
    // Get property names for all communities
    const propertyMap = await getPropertyNameMap();
    
    // Enhance entries with property names
    enhancedEntries = result.recordset.map(entry => ({
      ...entry,
      property_name: propertyMap[entry.property_id] || `Property ${entry.property_id}`
    }));
    
    // Calculate summary stats (same as in other endpoints)
    let totalHours = 0;
    const communitySet = new Set();
    let latestEntryDate = null;
    
    // Build community breakdown for chart
    const communityBreakdown = {};
    
    enhancedEntries.forEach(entry => {
      // Add to total hours
      totalHours += parseFloat(entry.hours);
      
      // Add to unique communities
      communitySet.add(entry.property_id);
      
      // Track latest date
      const entryDate = new Date(entry.date);
      if (!latestEntryDate || entryDate > new Date(latestEntryDate)) {
        latestEntryDate = entry.date;
      }
      
      // Build community breakdown
      if (!communityBreakdown[entry.property_id]) {
        communityBreakdown[entry.property_id] = {
          name: entry.property_name || `Property ${entry.property_id}`,
          hours: 0
        };
      }
      communityBreakdown[entry.property_id].hours += parseFloat(entry.hours);
    });
    
    // Format latest date as MM/DD/YYYY if it exists
    const formattedLatestDate = latestEntryDate 
      ? new Date(latestEntryDate).toLocaleDateString()
      : null;
    
    // Create response object
    const responseData = {
      success: true,
      summaryStats: {
        totalHours,
        communityCount: communitySet.size,
        latestEntryDate: formattedLatestDate
      },
      entries: enhancedEntries,
      communityBreakdown
    };
    
    console.log(`Found ${enhancedEntries.length} time entries for my communities dashboard`);
    res.json(responseData);
    
  } catch (error) {
    console.error('Error fetching my communities dashboard data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch my communities dashboard data',
      error: error.message
    });
  }
});

// User dashboard endpoint - shows only user's managed properties
app.get('/api/my-submissions', conditionalAuth, async (req, res) => {
  try {
    const email = req.user?.email || req.query.email; // Get from authenticated user or query param
    
    if (!email) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email is required' 
      });
    }
    const month = parseInt(req.query.month) || new Date().getMonth() + 1;
    const year = parseInt(req.query.year) || new Date().getFullYear();
    
    // Validate month and year
    if (month < 1 || month > 12) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid month. Must be between 1 and 12.' 
      });
    }
    
    if (year < 2000 || year > new Date().getFullYear() + 1) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid year' 
      });
    }
    
    console.log(`Fetching dashboard for authenticated user ${email} for ${month}/${year}`);
    
    // Get entries from PropertyTime table
    const result = await sql.query`
      SELECT 
        property_id,
        user_name,
        email_address,
        date,
        hours,
        notes
      FROM dbo.PropertyTime
      WHERE 
        email_address = ${email}
        AND MONTH(date) = ${month}
        AND YEAR(date) = ${year}
      ORDER BY date DESC
    `
    
    // Get property names from staff directory for joining (only for properties managed by this user)
    const propertyMap = await getPropertyNameMap();
    
    // Enhance entries with property names
    const enhancedEntries = result.recordset.map(entry => ({
      ...entry,
      property_name: propertyMap[entry.property_id] || `Property ${entry.property_id}`
    }));
    
    // Calculate summary stats
    let totalHours = 0;
    const communitySet = new Set();
    let latestEntryDate = null;
    
    // Build community breakdown for chart
    const communityBreakdown = {};
    
    enhancedEntries.forEach(entry => {
      // Add to total hours
      totalHours += parseFloat(entry.hours);
      
      // Add to unique communities
      communitySet.add(entry.property_id);
      
      // Track latest date
      const entryDate = new Date(entry.date);
      if (!latestEntryDate || entryDate > new Date(latestEntryDate)) {
        latestEntryDate = entry.date;
      }
      
      // Build community breakdown
      if (!communityBreakdown[entry.property_id]) {
        communityBreakdown[entry.property_id] = {
          name: entry.property_name || `Property ${entry.property_id}`,
          hours: 0
        };
      }
      communityBreakdown[entry.property_id].hours += parseFloat(entry.hours);
    });
    
    // Format latest date as MM/DD/YYYY if it exists
    const formattedLatestDate = latestEntryDate 
      ? new Date(latestEntryDate).toLocaleDateString()
      : null;
    
    // Create response object
    const responseData = {
      success: true,
      summaryStats: {
        totalHours,
        communityCount: communitySet.size,
        latestEntryDate: formattedLatestDate
      },
      entries: enhancedEntries,
      communityBreakdown
    };
    
    console.log(`Found ${enhancedEntries.length} time entries for dashboard`);
    res.json(responseData);
    
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard data',
      error: error.message
    });
  }
});

// Retrieve time entries for a specific user
app.get('/api/time-entries', conditionalAuth, conditionalRole([2, 3]), async (req, res) => {
  try {
    const { email } = req.query;
    
    if (!email) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email is required' 
      });
    }
    
    console.log(`Fetching time entries for user: ${email}`);
    
    // Get entries from PropertyTime table
    const result = await sql.query`
      SELECT TOP 50
        property_id,
        user_name,
        email_address,
        date,
        hours,
        notes
      FROM dbo.PropertyTime
      WHERE email_address = ${email}
      ORDER BY date DESC
    `;
    
    // Get property names from staff directory for joining
    const propertyNamesQuery = await sql.query`
      SELECT DISTINCT property_id, property_name
      FROM dbo.vw_PropertyStaffDirectory
      WHERE email_address = ${email}
    `;
    
    // Create a lookup map for property names
    const propertyMap = {};
    propertyNamesQuery.recordset.forEach(record => {
      propertyMap[record.property_id] = record.property_name;
    });
    
    // Enhance entries with property names
    const enhancedEntries = result.recordset.map(entry => ({
      ...entry,
      property_name: propertyMap[entry.property_id] || null
    }));
    
    console.log(`Found ${enhancedEntries.length} time entries`);
    
    res.json({
      success: true,
      entries: enhancedEntries,
      count: enhancedEntries.length
    });
    
  } catch (error) {
    console.error('Error fetching time entries:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch time entries',
      error: error.message
    });
  }
});

// User info endpoint
app.get('/api/user', conditionalAuth, async (req, res) => {
  try {
    const { email } = req.query;
    
    if (!email) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email is required' 
      });
    }
    
    console.log(`Fetching user data for: ${email}`);
    
    // Query to get user data
    const result = await sql.query`
      SELECT DISTINCT 
        email_address as email,
        user_name as name,
        user_id as id
      FROM 
        dbo.vw_PropertyStaffDirectory
      WHERE 
        email_address = ${email}
    `;
    
    if (result.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    res.json({
      success: true,
      user: result.recordset[0]
    });
    
  } catch (error) {
    console.error('Error fetching user data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user data',
      error: error.message
    });
  }
});

// =============================================
// Admin endpoints
// =============================================

// Admin dashboard endpoint - shows all properties across all users
app.get('/api/admin/dashboard', verifyGoogleToken, requireAdmin, async (req, res) => {
  try {
    const month = parseInt(req.query.month) || new Date().getMonth() + 1;
    const year = parseInt(req.query.year) || new Date().getFullYear();
    
    console.log(`Fetching ADMIN dashboard for ${month}/${year}`);
    
    // Get ALL entries from PropertyTime table for the specified month/year
    const result = await sql.query`
      SELECT 
        property_id,
        user_name,
        email_address,
        date,
        hours,
        notes
      FROM dbo.PropertyTime
      WHERE 
        MONTH(date) = ${month}
        AND YEAR(date) = ${year}
      ORDER BY date DESC
    `;
    
    // Get ALL property names from staff directory
    const propertyMap = await getPropertyNameMap();
    
    // Enhance entries with property names
    const enhancedEntries = result.recordset.map(entry => ({
      ...entry,
      property_name: propertyMap[entry.property_id] || `Property ${entry.property_id}`
    }));
    
    // Calculate summary stats
    let totalHours = 0;
    const communitySet = new Set();
    let latestEntryDate = null;
    
    // Build community breakdown for chart
    const communityBreakdown = {};
    
    enhancedEntries.forEach(entry => {
      // Add to total hours
      totalHours += parseFloat(entry.hours);
      
      // Add to unique communities
      communitySet.add(entry.property_id);
      
      // Track latest date
      const entryDate = new Date(entry.date);
      if (!latestEntryDate || entryDate > new Date(latestEntryDate)) {
        latestEntryDate = entry.date;
      }
      
      // Build community breakdown
      if (!communityBreakdown[entry.property_id]) {
        communityBreakdown[entry.property_id] = {
          name: entry.property_name || `Property ${entry.property_id}`,
          hours: 0
        };
      }
      communityBreakdown[entry.property_id].hours += parseFloat(entry.hours);
    });
    
    // Format latest date as MM/DD/YYYY if it exists
    const formattedLatestDate = latestEntryDate 
      ? new Date(latestEntryDate).toLocaleDateString()
      : null;
    
    // Create response object
    const responseData = {
      success: true,
      summaryStats: {
        totalHours,
        communityCount: communitySet.size,
        latestEntryDate: formattedLatestDate
      },
      entries: enhancedEntries,
      communityBreakdown
    };
    
    console.log(`Found ${enhancedEntries.length} time entries for admin dashboard`);
    res.json(responseData);
    
  } catch (error) {
    console.error('Error fetching admin dashboard data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch admin dashboard data',
      error: error.message
    });
  }
});

// Admin endpoint to fetch all communities
app.get('/api/admin/all-communities', conditionalAuth, conditionalAdmin, async (req, res) => {
  try {
    console.log('Fetching all communities for admin mode');
    
    // Query to get all unique properties
    const result = await sql.query`
      SELECT DISTINCT 
        property_id as ID, 
        property_name as Name
      FROM 
        dbo.vw_PropertyStaffDirectory
      ORDER BY 
        property_name
    `;
    
    // Format for admin mode (no role info needed)
    const communities = result.recordset.map(item => ({
      ID: item.ID,
      Name: item.Name,
      DisplayName: item.Name
    }));
    
    res.json(communities);
    
  } catch (error) {
    console.error('Error fetching all communities:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch all communities',
      error: error.message
    });
  }
});

// Endpoint to verify admin password
app.post('/api/admin/verify-password', authLimiter, (req, res) => {
  const { password } = req.body;
  const adminPassword = process.env.REACT_APP_ADMIN_PASSWORD;
  
  console.log('🔍 Server checking admin password');
  
  if (password === adminPassword) {
    res.json({ success: true });
  } else {
    res.json({ success: false, message: 'Invalid admin password' });
  }
});

// Alternative endpoint name for admin validation (used by new frontend)
app.post('/api/admin/validate', authLimiter, (req, res) => {
  const { password } = req.body;
  const adminPassword = process.env.REACT_APP_ADMIN_PASSWORD;
  
  console.log('🔍 Server checking admin password via /validate endpoint');
  
  if (password === adminPassword) {
    res.json({ success: true });
  } else {
    res.json({ success: false, message: 'Invalid admin password' });
  }
});

// Admin endpoint to get all users
app.get('/api/admin/all-users', conditionalAuth, conditionalAdmin, async (req, res) => {
  try {
    console.log('Fetching all users for admin mode');
    
    const result = await sql.query`
      SELECT 
        property_id,
        property_name,
        user_name,
        email_address,
        user_role,
        user_role_id
      FROM dbo.vw_PropertyStaffDirectory
      WHERE email_address IS NOT NULL AND email_address != ''
      ORDER BY user_name
    `;
    
    // Create a map to deduplicate users while preserving all data
    const userMap = new Map();
    
    result.recordset.forEach(row => {
      const key = row.email_address;
      if (!userMap.has(key)) {
        userMap.set(key, {
          user_name: row.user_name,
          email_address: row.email_address,
          user_role: row.user_role,
          user_role_id: row.user_role_id,
          properties: []
        });
      }
      
      // Add this property to the user's properties array
      userMap.get(key).properties.push({
        property_id: row.property_id,
        property_name: row.property_name
      });
    });
    
    // Convert map to array
    const uniqueUsers = Array.from(userMap.values());
    
    res.json({
      success: true,
      users: uniqueUsers
    });
  } catch (error) {
    console.error('Error fetching all users:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching users'
    });
  }
});

// Admin endpoint to get communities for a specific user
app.get('/api/admin/user-communities', conditionalAuth, conditionalAdmin, async (req, res) => {
  const userEmail = req.query.email;
  
  if (!userEmail) {
    return res.status(400).json({
      success: false,
      message: 'Email parameter is required'
    });
  }
  
  try {
    console.log('Fetching communities for user:', userEmail);
    
    const result = await sql.query`
      SELECT DISTINCT property_id as id, property_name as name
      FROM dbo.vw_PropertyStaffDirectory
      WHERE email_address = ${userEmail}
      ORDER BY property_name
    `;
    
    res.json({
      success: true,
      communities: result.recordset
    });
  } catch (error) {
    console.error('Error fetching user communities:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching user communities'
    });
  }
});

// Submit assessment entries endpoint (NEW ASSESSMENT SYSTEM)
app.post('/api/submit-assessment', async (req, res) => {
  console.log('=== START ASSESSMENT SUBMISSION ===');
  try {
    console.log('Received assessment data:', JSON.stringify(req.body, null, 2));
    
    const { userId, month, year, submissionType, entries, submissionDate, submissionTimestamp } = req.body;
    
    // Validation
    if (!userId) {
      return res.status(400).json({ success: false, message: 'userId is required' });
    }
    if (!month || !year) {
      return res.status(400).json({ success: false, message: 'month and year are required' });
    }
    if (!submissionType || !['Manager', 'Accounting'].includes(submissionType)) {
      return res.status(400).json({ success: false, message: 'Valid submissionType is required' });
    }
    if (!entries || !Array.isArray(entries) || entries.length === 0) {
      return res.status(400).json({ success: false, message: 'entries must be a non-empty array' });
    }
    if (!submissionDate) {
      return res.status(400).json({ success: false, message: 'submissionDate is required' });
    }

    console.log(`Processing ${entries.length} assessment entries for user ${userId}`);
    console.log(`Using client-provided submission date: ${submissionDate}`);

    // Process each entry
    const insertPromises = entries.map(async (entry) => {
      const { communityId, responses, otherText } = entry;
      
      console.log(`Processing community ID: ${communityId}`);
      
      // Map responses to database columns based on submission type
      let columnData = {};
      if (submissionType === 'Manager') {
        columnData = {
          cq1: responses[0] || 0,
          cq2: responses[1] || 0,
          cq3: responses[2] || 0,
          cq4: responses[3] || 0,
          cq5: responses[4] || 0,
          cq5_other: otherText || null
        };
      } else { // Accounting
        columnData = {
          aq1: responses[0] || 0,
          aq2: responses[1] || 0,
          aq3: responses[2] || 0,
          aq4: responses[3] || 0,
          aq5: responses[4] || 0,
          aq5_other: otherText || null
        };
      }

      // Insert into PropertyTime table
      const insertQuery = `
        INSERT INTO dbo.PropertyTime (
          property_id, user_name, email_address, 
          submission_date, month, year, submission_type,
          ${Object.keys(columnData).join(', ')}
        ) VALUES (
          @property_id, @user_name, @email_address,
          @submission_date, @month, @year, @submission_type,
          ${Object.keys(columnData).map(key => `@${key}`).join(', ')}
        )
      `;

      const request = new sql.Request();
      request.input('property_id', sql.Int, communityId);
      request.input('user_name', sql.NVarChar(255), userId);
      request.input('email_address', sql.NVarChar(255), userId);
      request.input('submission_date', sql.NVarChar(255), submissionDate); // Use client-provided local time string
      request.input('month', sql.Int, month);
      request.input('year', sql.Int, year);
      request.input('submission_type', sql.NVarChar(50), submissionType);
      
      // Add column-specific parameters
      Object.entries(columnData).forEach(([key, value]) => {
        if (key === 'cq5_other' || key === 'aq5_other') {
          request.input(key, sql.NVarChar(sql.MAX), value);
        } else {
          request.input(key, sql.Int, value);
        }
      });

      console.log(`Executing insert query for community ${communityId}`);
      const result = await request.query(insertQuery);
      console.log(`Insert result for community ${communityId}:`, result.rowsAffected);
      
      return result;
    });

    // Wait for all insertions to complete
    await Promise.all(insertPromises);
    
    console.log('All assessment entries processed successfully');
    
    res.json({ 
      success: true, 
      message: `${submissionType} assessment submitted successfully`,
      submittedEntries: entries.length
    });
    
  } catch (error) {
    console.error('Error in submit-assessment endpoint:', error);
    if (error.originalError) {
      console.error('Original SQL error:', error.originalError);
    }
    res.status(500).json({ 
      success: false, 
      message: 'Failed to submit assessment',
      error: error.message
    });
  } finally {
    console.log('=== END ASSESSMENT SUBMISSION ===');
  }
});

// Check submission status for all communities (batch check for UX enhancement)
app.post('/api/check-all-communities-status', conditionalAuth, conditionalRole([2, 3]), async (req, res) => {
  try {
    const { userId, month, year, submissionType } = req.body;
    
    if (!userId || !month || !year || !submissionType) {
      return res.status(400).json({ success: false, message: 'Missing required parameters' });
    }

    console.log(`Checking submission status for all communities - User: ${userId}, ${submissionType} ${month}/${year}`);

    // Query for all submitted communities for this user/month/year/type
    const request = new sql.Request();
    request.input('email', sql.NVarChar(255), userId);
    request.input('month', sql.Int, parseInt(month));
    request.input('year', sql.Int, parseInt(year));
    request.input('submissionType', sql.NVarChar(50), submissionType);

    const query = `
      SELECT DISTINCT p.property_id
      FROM dbo.PropertyTime p
      WHERE p.email_address = @email 
        AND p.month = @month 
        AND p.year = @year 
        AND p.submission_type = @submissionType
    `;

    const result = await request.query(query);
    const submittedCommunityIds = result.recordset.map(row => row.property_id);

    console.log(`Found ${submittedCommunityIds.length} submitted communities`);

    res.json({ 
      success: true, 
      submittedCommunityIds: submittedCommunityIds
    });

  } catch (error) {
    console.error('Error checking all communities status:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to check communities status',
      error: error.message
    });
  }
});

// Check for duplicate submission for a specific community endpoint
app.post('/api/check-community-duplicate', conditionalAuth, conditionalRole([2, 3]), async (req, res) => {
  try {
    const { userId, month, year, submissionType, communityId } = req.body;
    
    if (!userId || !month || !year || !submissionType || !communityId) {
      return res.status(400).json({ success: false, message: 'Missing required parameters' });
    }

    console.log(`Checking duplicate for community ${communityId}, user ${userId}, ${submissionType} ${month}/${year}`);

    // Query for existing submission for this specific community
    const request = new sql.Request();
    request.input('email', sql.NVarChar(255), userId);
    request.input('month', sql.Int, parseInt(month));
    request.input('year', sql.Int, parseInt(year));
    request.input('submissionType', sql.NVarChar(50), submissionType);
    request.input('communityId', sql.Int, parseInt(communityId));

    const query = `
      SELECT COUNT(*) as count
      FROM dbo.PropertyTime p
      WHERE p.email_address = @email 
        AND p.month = @month 
        AND p.year = @year 
        AND p.submission_type = @submissionType
        AND p.property_id = @communityId
    `;

    const result = await request.query(query);
    const isDuplicate = result.recordset[0].count > 0;

    console.log(`Duplicate check result: ${isDuplicate ? 'DUPLICATE FOUND' : 'No duplicate'}`);

    res.json({ 
      success: true, 
      isDuplicate: isDuplicate
    });

  } catch (error) {
    console.error('Error checking community duplicate:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to check for community duplicate',
      error: error.message
    });
  }
});

// Check for duplicate submissions endpoint
app.post('/api/check-duplicates', conditionalAuth, conditionalRole([2, 3]), async (req, res) => {
  try {
    const { userId, month, year, submissionType, communityIds } = req.body;
    
    if (!userId || !month || !year || !submissionType) {
      return res.status(400).json({ success: false, message: 'Missing required parameters' });
    }

    if (!communityIds || communityIds.length === 0) {
      return res.json({ success: true, duplicates: [] });
    }

    console.log(`Checking duplicates for ${communityIds.length} communities`);

    // Query for existing submissions
    const request = new sql.Request();
    request.input('email', sql.NVarChar(255), userId);
    request.input('month', sql.Int, parseInt(month));
    request.input('year', sql.Int, parseInt(year));
    request.input('submissionType', sql.NVarChar(50), submissionType);

    const placeholders = communityIds.map((_, index) => `@community${index}`).join(',');
    communityIds.forEach((id, index) => {
      request.input(`community${index}`, sql.Int, parseInt(id));
    });

    const query = `
      SELECT DISTINCT p.property_id, v.property_name
      FROM dbo.PropertyTime p
      INNER JOIN dbo.vw_PropertyStaffDirectory v ON p.property_id = v.property_id
      WHERE p.email_address = @email 
        AND p.month = @month 
        AND p.year = @year 
        AND p.submission_type = @submissionType
        AND p.property_id IN (${placeholders})
    `;

    const result = await request.query(query);
    const duplicates = result.recordset.map(row => row.property_name);

    console.log(`Found ${duplicates.length} duplicate submissions`);

    res.json({ 
      success: true, 
      duplicates: duplicates
    });

  } catch (error) {
    console.error('Error checking duplicates:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to check for duplicates',
      error: error.message
    });
  }
});

// Serve static files from the React app build directory
app.use(express.static(path.join(__dirname, '../client/build')));

// Catch-all handler: send back React's index.html file for any non-API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/build/index.html'));
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});

// connecting to database
connectToDatabase();