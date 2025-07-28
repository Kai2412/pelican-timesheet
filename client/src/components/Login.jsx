import React, { useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext.jsx';

const Login = () => {
  const { handleLogin } = useAuth();
  
  // TEMPORARY DEBUG - Remove after testing
  console.log('🔍 Debug - Google Client ID loaded:', import.meta.env.VITE_GOOGLE_CLIENT_ID ? 'YES' : 'NO');
  console.log('🔍 Debug - Client ID value:', import.meta.env.VITE_GOOGLE_CLIENT_ID);
  
  // Wrap handleCredentialResponse in useCallback to make it stable across renders
  const handleCredentialResponse = useCallback((response) => {
    console.log('Received response from Google');
    try {
      if (response && response.credential) {
        // Decode the JWT token
        const payload = JSON.parse(atob(response.credential.split('.')[1]));
        console.log('Decoded credential payload');
        
        // Send the user data to our authentication context
        handleLogin({
          sub: payload.sub,
          name: payload.name,
          email: payload.email,
          picture: payload.picture,
          exp: payload.exp
        });
      } else {
        console.error('Invalid response from Google Sign-In');
      }
    } catch (error) {
      console.error('Error handling Google response:', error);
    }
  }, [handleLogin]); // Add handleLogin as a dependency
  
  // Initialize Google Sign-In
  useEffect(() => {
    // Clean up any existing buttons to avoid duplicates
    const existingButtons = document.querySelectorAll('.google-button-container > div');
    existingButtons.forEach(button => button.remove());
    
    // Check if Google library is already loaded
    if (window.google && window.google.accounts) {
      // Google SDK already loaded - no need to log this repeatedly
      try {
        window.google.accounts.id.initialize({
          client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
          callback: handleCredentialResponse,
          auto_select: false
        });
        
        window.google.accounts.id.renderButton(
          document.getElementById('google-signin-button'),
          { 
            type: 'standard',
            theme: 'outline', 
            size: 'large',
            text: 'signin_with',
            shape: 'rectangular',
            logo_alignment: 'center'
          }
        );
        // Google Sign-In button rendered successfully
      } catch (error) {
        console.error('Error initializing Google Sign-In:', error);
      }
    } else {
      // Load the Google Sign-In script if not already loaded
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => {
        // Google script loaded successfully
        try {
          window.google.accounts.id.initialize({
            client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
            callback: handleCredentialResponse,
            auto_select: false
          });
          
          window.google.accounts.id.renderButton(
            document.getElementById('google-signin-button'),
            { 
              type: 'standard',
              theme: 'outline', 
              size: 'large',
              text: 'signin_with',
              shape: 'rectangular',
              logo_alignment: 'center'
            }
          );
          console.log('Google Sign-In button rendered');
        } catch (error) {
          console.error('Error initializing Google Sign-In after script load:', error);
        }
      };
      script.onerror = (error) => {
        console.error('Failed to load Google script:', error);
      };
      document.body.appendChild(script);
    }
    
    return () => {
      // Cleanup function - attempt to cancel any Google Sign-In operations
      try {
        if (window.google && window.google.accounts) {
          window.google.accounts.id.cancel();
        }
      } catch (e) {
        console.error('Error during cleanup:', e);
      }
    };
  }, [handleCredentialResponse]); // Add handleCredentialResponse as a dependency
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-800"> {/* Dark slate background */}
      <div className="p-8 max-w-md w-full rounded-lg bg-white shadow-xl text-center mx-4">
        <div className="space-y-6">
          <h1 className="text-xl font-bold text-neutral-800">Community Time Sheet</h1>
          <p className="text-neutral-600">Please sign in to continue</p>
          
          {/* Google Sign-In Button Container */}
          <div 
            id="google-signin-button" 
            className="google-button-container h-12 w-full flex justify-center items-center"
          />
        </div>
      </div>
    </div>
  );
};

export default Login;