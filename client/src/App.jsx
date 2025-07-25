import React, { useState, useEffect } from 'react';
import { useGoogleLogin } from '@react-oauth/google';
import axios from 'axios';
import Login from './components/Login.jsx';
import TimeSheetForm from './components/TimeSheetForm.jsx';
import { Toaster } from 'react-hot-toast';
import { Moon, Sun, LogOut } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { ThemeProvider, useTheme } from './context/ThemeContext.jsx';
import { ToastProvider } from './components/ui/Toast.jsx';
import Button from './components/ui/Button.jsx';

// Main App content that uses authentication
function AppContent() {
  const { colorMode, toggleColorMode } = useTheme();
  const { currentUser, isLoading, logout } = useAuth();

  // Show loading spinner when authentication is in progress
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-neutral-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  // Show login if no authenticated user
  if (!currentUser) {
    return <Login />;
  }

  // Show main application when authenticated
  return (
    <>
      <header className="bg-primary-500 text-white p-0 mb-8">
        <div className="flex justify-between items-stretch h-20 p-0 w-full">
          {/* Logo and Title Section */}
          <div className="flex items-stretch w-full">
            <div
              className="h-20 w-20 bg-contain bg-no-repeat bg-center flex-shrink-0"
              style={{ backgroundImage: "url('/logo.png')" }}
            />
            
            {/* Title and Controls Area */}
            <div className="flex-1 pl-4 flex flex-col justify-center">
              {/* Top Row: Title */}
              <div>
                <h1 className="text-lg md:text-xl font-bold">
                  Community Time Sheet
                </h1>
              </div>
              
              {/* Bottom Row: Controls (mobile only) */}
              <div className="flex md:hidden justify-end items-center w-full pr-4">
                <div className="flex items-center space-x-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={toggleColorMode}
                    className="text-white hover:bg-primary-600 p-2"
                  >
                    {colorMode === 'light' ? <Moon size={16} /> : <Sun size={16} />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={logout}
                    className="text-white hover:bg-primary-600"
                  >
                    Logout
                  </Button>
                </div>
              </div>
            </div>
          </div>
          
          {/* Desktop Controls (hidden on mobile) */}
          <div className="hidden md:flex items-center space-x-3 pr-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleColorMode}
              className="text-white hover:bg-primary-600 active:bg-primary-700 p-2"
            >
              {colorMode === 'light' ? <Moon size={16} /> : <Sun size={16} />}
            </Button>
            {currentUser && (
              <Button
                variant="ghost"
                onClick={logout}
                className="text-white hover:bg-primary-600 active:bg-primary-700"
              >
                <LogOut size={16} className="mr-2" />
                Logout
              </Button>
            )}
          </div>
        </div>
      </header>
      
      {/* Main Form Component */}
      <TimeSheetForm userInfo={currentUser} />
    </>
  );
}

// Root App component that provides context
function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider />
        <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900">
          <Toaster position="top-right" />
          <AppContent />
        </div>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;