/**
 * Client Configuration Settings
 * 
 * These settings control application behavior and can be modified per client deployment.
 * Changes require a redeploy to take effect.
 */

module.exports = {
  // Assessment Question Validation
  // Set to true to make assessment questions required for form submission
  // Set to false to make questions optional (only percentage slider required)
  questionsRequired: false, // Default: optional

  // Security Settings
  security: {
    // Enable strict authentication (requires all API endpoints to be authenticated)
    strictAuth: false, // DISABLED - Frontend not ready for OAuth tokens
    
    // API Rate Limiting (requests per 15 minutes)
    rateLimits: {
      general: 100,      // General API requests
      auth: 5,           // Authentication attempts
      submissions: 20    // Form submissions per 5 minutes
    },
    
    // Input validation settings
    validation: {
      maxEntriesPerSubmission: 20,
      maxNoteLength: 500,
      maxHoursPerEntry: 24
    },
    
    // Allowed domains for CORS (production)
    allowedOrigins: [
      'https://pelicantimesubmission.fly.dev',
      'https://pelican.refracted.io'
    ]
  },

  // Future settings can be added here as needed
  // Example:
  // maxCommunityEntries: 10,
  // enableAdvancedReporting: true,
};
