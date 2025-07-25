import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import axios from 'axios';

// Create the context
export const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  // State for the current authenticated user
  const [currentUser, setCurrentUser] = useState(null);
  
  // State for available communities
  const [communities, setCommunities] = useState([]);
  
  // State for selected community
  const [selectedCommunity, setSelectedCommunity] = useState(null);
  
  // State for impersonated user email (for admin features)
  const [impersonatedEmail, setImpersonatedEmail] = useState('');
  
  // Loading state
  const [isLoading, setIsLoading] = useState(false);

  // Handle authentication after Google sign-in
  const handleLogin = (userData) => {
    setCurrentUser({
      sub: userData.sub,
      name: userData.name,
      email: userData.email,
      picture: userData.picture,
      exp: userData.exp || Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
    });
    
    // Store in localStorage for session persistence
    localStorage.setItem('userInfo', JSON.stringify({
      name: userData.name,
      email: userData.email,
      picture: userData.picture,
    }));
  };

  // Log out the current user
  const logout = () => {
    setCurrentUser(null);
    setCommunities([]);
    setSelectedCommunity(null);
    setImpersonatedEmail('');
    localStorage.removeItem('userInfo');
  };

  // Fetch communities for the logged-in user
  const fetchCommunities = useCallback(async (useAdminOverride = false) => {
    try {
      setIsLoading(true);
      
      const email = impersonatedEmail || (currentUser?.email);
      if (!email) return;
      
      // Build URL with query parameters
      let url = '/api/user-communities';
      const params = new URLSearchParams();
      
      if (useAdminOverride) params.append('adminOverride', 'true');
      params.append('email', email);
      
      const response = await axios.get(`${url}?${params.toString()}`);
      const fetchedCommunities = response.data.communities;
      
      setCommunities(fetchedCommunities);
      
      // If we have communities and none selected yet, select the first one
      if (fetchedCommunities.length > 0 && !selectedCommunity) {
        setSelectedCommunity(fetchedCommunities[0]);
      }
      
    } catch (error) {
      console.error('Error fetching communities:', error);
    } finally {
      setIsLoading(false);
    }
  }, [impersonatedEmail, currentUser]); // Fixed dependencies

  // Select a community by ID
  const selectCommunity = (communityId) => {
    const community = communities.find(c => Number(c.ID) === Number(communityId));
    setSelectedCommunity(community || null);
  };

  // Get available users for admin panel
  const getAvailableUsers = async () => {
    try {
      const response = await axios.get('/api/admin/available-users');
      return response.data.users;
    } catch (error) {
      console.error('Error fetching available users:', error);
      return [];
    }
  };

  // Impersonate a user by email (admin feature)
  const impersonateUser = async (email) => {
    try {
      const response = await axios.post('/api/admin/impersonate', { email });
      
      if (response.data.success) {
        setImpersonatedEmail(email);
        // Refresh communities for the impersonated user
        fetchCommunities();
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error impersonating user:', error);
      return false;
    }
  };

  // Reset impersonation
  const resetImpersonation = () => {
    setImpersonatedEmail('');
    // Refresh communities for the original user
    fetchCommunities();
  };

  // Check if user is already logged in on mount
  useEffect(() => {
    const storedUser = localStorage.getItem('userInfo');
    if (storedUser) {
      try {
        const userData = JSON.parse(storedUser);
        setCurrentUser({
          ...userData,
          exp: Math.floor(Date.now() / 1000) + 3600, // Refresh the expiry time
        });
      } catch (error) {
        console.error('Error parsing stored user info:', error);
        localStorage.removeItem('userInfo');
      }
    }
  }, []);

  // Fetch communities when user changes
  useEffect(() => {
    if (currentUser) {
      fetchCommunities();
    }
  }, [currentUser, impersonatedEmail]); // Remove fetchCommunities from deps

  // The context value that will be provided
  const value = {
    currentUser,
    communities,
    selectedCommunity,
    impersonatedEmail,
    isLoading,
    handleLogin,
    logout,
    fetchCommunities,
    selectCommunity,
    getAvailableUsers,
    impersonateUser,
    resetImpersonation
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};