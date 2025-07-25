import React from 'react';
import clsx from 'clsx';

export const Input = React.forwardRef(({
  label,
  error,
  className,
  required,
  ...props
}, ref) => {
  return (
    <div className="w-full">
      {label && (
        <label className="form-label">
          {label}
          {required && <span className="text-error-500 ml-1">*</span>}
        </label>
      )}
      <input
        ref={ref}
        className={clsx(
          'form-input',
          error && 'border-error-500 focus:border-error-500 focus:ring-error-500',
          className
        )}
        {...props}
      />
      {error && (
        <p className="mt-1 text-sm text-error-600 dark:text-error-400">{error}</p>
      )}
    </div>
  );
});

export const Textarea = React.forwardRef(({
  label,
  error,
  className,
  required,
  rows = 3,
  ...props
}, ref) => {
  return (
    <div className="w-full">
      {label && (
        <label className="form-label">
          {label}
          {required && <span className="text-error-500 ml-1">*</span>}
        </label>
      )}
      <textarea
        ref={ref}
        rows={rows}
        className={clsx(
          'form-input resize-none',
          error && 'border-error-500 focus:border-error-500 focus:ring-error-500',
          className
        )}
        {...props}
      />
      {error && (
        <p className="mt-1 text-sm text-error-600 dark:text-error-400">{error}</p>
      )}
    </div>
  );
});

export const Select = React.forwardRef(({
  label,
  error,
  className,
  required,
  children,
  ...props
}, ref) => {
  return (
    <div className="w-full">
      {label && (
        <label className="form-label">
          {label}
          {required && <span className="text-error-500 ml-1">*</span>}
        </label>
      )}
      <select
        ref={ref}
        className={clsx(
          'form-input',
          error && 'border-error-500 focus:border-error-500 focus:ring-error-500',
          className
        )}
        {...props}
      >
        {children}
      </select>
      {error && (
        <p className="mt-1 text-sm text-error-600 dark:text-error-400">{error}</p>
      )}
    </div>
  );
});

Input.displayName = 'Input';
Textarea.displayName = 'Textarea';
Select.displayName = 'Select';
