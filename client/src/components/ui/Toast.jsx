import React from 'react';
import toast, { Toaster } from 'react-hot-toast';

// Custom toast function that matches Chakra UI's useToast API
export const useToast = () => {
  return ({ title, description, status = 'success', duration = 4000 }) => {
    const toastOptions = {
      duration,
      position: 'top-right',
    };

    const content = (
      <div>
        <div className="font-medium">{title}</div>
        {description && <div className="text-sm opacity-90">{description}</div>}
      </div>
    );

    switch (status) {
      case 'success':
        toast.success(content, toastOptions);
        break;
      case 'error':
        toast.error(content, toastOptions);
        break;
      case 'warning':
        toast(content, { ...toastOptions, icon: '⚠️' });
        break;
      case 'info':
        toast(content, { ...toastOptions, icon: 'ℹ️' });
        break;
      default:
        toast(content, toastOptions);
    }
  };
};

// Toast provider component
export const ToastProvider = () => {
  return (
    <Toaster
      position="top-right"
      toastOptions={{
        className: '',
        style: {
          background: 'var(--toast-bg)',
          color: 'var(--toast-color)',
          borderRadius: '0.5rem',
          border: '1px solid var(--toast-border)',
        },
      }}
    />
  );
};

// CSS variables for theming (add to your CSS)
export const toastStyles = `
  :root {
    --toast-bg: #ffffff;
    --toast-color: #374151;
    --toast-border: #e5e7eb;
  }
  
  .dark {
    --toast-bg: #1f2937;
    --toast-color: #f9fafb;
    --toast-border: #374151;
  }
`;
