import React, { useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { X } from 'lucide-react';
import { Fragment } from 'react';
import Button from './Button.jsx';

export const Modal = ({ 
  isOpen, 
  onClose, 
  title, 
  children, 
  size = 'md',
  showCloseButton = true 
}) => {
  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    full: 'max-w-7xl mx-4',
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-25" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className={`w-full ${sizeClasses[size]} transform overflow-hidden rounded-lg bg-white dark:bg-neutral-800 p-6 text-left align-middle shadow-xl transition-all`}>
                {(title || showCloseButton) && (
                  <div className="flex items-center justify-between mb-4">
                    {title && (
                      <Dialog.Title
                        as="h3"
                        className="text-lg font-medium leading-6 text-neutral-900 dark:text-neutral-100"
                      >
                        {title}
                      </Dialog.Title>
                    )}
                    {showCloseButton && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={onClose}
                        className="p-1 hover:bg-neutral-100 dark:hover:bg-neutral-700"
                      >
                        <X size={16} />
                      </Button>
                    )}
                  </div>
                )}
                {children}
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

export const ModalContent = ({ children }) => {
  return <div className="mt-2">{children}</div>;
};

export const ModalFooter = ({ children }) => {
  return (
    <div className="mt-6 flex justify-end space-x-3">
      {children}
    </div>
  );
};
