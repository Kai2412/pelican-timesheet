import React from 'react';
import clsx from 'clsx';

export const Card = ({ children, className, ...props }) => {
  return (
    <div
      className={clsx(
        'bg-white dark:bg-neutral-800 rounded-lg shadow-sm',
        // Only apply default border if no custom border is provided
        !className?.includes('border') && 'border border-neutral-200 dark:border-neutral-700',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

export const CardHeader = ({ children, className, ...props }) => {
  return (
    <div
      className={clsx('px-6 py-4 border-b border-neutral-200 dark:border-neutral-700', className)}
      {...props}
    >
      {children}
    </div>
  );
};

export const CardContent = ({ children, className, ...props }) => {
  return (
    <div className={clsx('px-6 py-4', className)} {...props}>
      {children}
    </div>
  );
};

export const CardFooter = ({ children, className, ...props }) => {
  return (
    <div
      className={clsx('px-6 py-4 border-t border-neutral-200 dark:border-neutral-700', className)}
      {...props}
    >
      {children}
    </div>
  );
};
