import React from 'react';

const ColorSystemDemo = () => {
  const colorGroups = [
    {
      name: 'Primary (Client Brand)',
      description: 'Use for headers, main buttons, logos',
      colors: [
        { name: 'primary-50', class: 'bg-primary-50', textClass: 'text-primary-900' },
        { name: 'primary-100', class: 'bg-primary-100', textClass: 'text-primary-900' },
        { name: 'primary-200', class: 'bg-primary-200', textClass: 'text-primary-900' },
        { name: 'primary-300', class: 'bg-primary-300', textClass: 'text-primary-900' },
        { name: 'primary-400', class: 'bg-primary-400', textClass: 'text-white' },
        { name: 'primary-500', class: 'bg-primary-500', textClass: 'text-white' },
        { name: 'primary-600', class: 'bg-primary-600', textClass: 'text-white' },
        { name: 'primary-700', class: 'bg-primary-700', textClass: 'text-white' },
        { name: 'primary-800', class: 'bg-primary-800', textClass: 'text-white' },
        { name: 'primary-900', class: 'bg-primary-900', textClass: 'text-white' },
      ]
    },
    {
      name: 'Secondary (Client Accent)',
      description: 'Use for outlines, focus states, section headers',
      colors: [
        { name: 'secondary-50', class: 'bg-secondary-50', textClass: 'text-secondary-900' },
        { name: 'secondary-100', class: 'bg-secondary-100', textClass: 'text-secondary-900' },
        { name: 'secondary-200', class: 'bg-secondary-200', textClass: 'text-secondary-900' },
        { name: 'secondary-300', class: 'bg-secondary-300', textClass: 'text-secondary-900' },
        { name: 'secondary-400', class: 'bg-secondary-400', textClass: 'text-white' },
        { name: 'secondary-500', class: 'bg-secondary-500', textClass: 'text-white' },
        { name: 'secondary-600', class: 'bg-secondary-600', textClass: 'text-white' },
        { name: 'secondary-700', class: 'bg-secondary-700', textClass: 'text-white' },
        { name: 'secondary-800', class: 'bg-secondary-800', textClass: 'text-white' },
        { name: 'secondary-900', class: 'bg-secondary-900', textClass: 'text-white' },
      ]
    },
    {
      name: 'Neutral (Slate - Universal)',
      description: 'Use for 90% of your UI - backgrounds, text, borders',
      colors: [
        { name: 'neutral-50', class: 'bg-neutral-50', textClass: 'text-neutral-900' },
        { name: 'neutral-100', class: 'bg-neutral-100', textClass: 'text-neutral-900' },
        { name: 'neutral-200', class: 'bg-neutral-200', textClass: 'text-neutral-900' },
        { name: 'neutral-300', class: 'bg-neutral-300', textClass: 'text-neutral-900' },
        { name: 'neutral-400', class: 'bg-neutral-400', textClass: 'text-white' },
        { name: 'neutral-500', class: 'bg-neutral-500', textClass: 'text-white' },
        { name: 'neutral-600', class: 'bg-neutral-600', textClass: 'text-white' },
        { name: 'neutral-700', class: 'bg-neutral-700', textClass: 'text-white' },
        { name: 'neutral-800', class: 'bg-neutral-800', textClass: 'text-white' },
        { name: 'neutral-900', class: 'bg-neutral-900', textClass: 'text-white' },
      ]
    },
    {
      name: 'Functional Colors',
      description: 'Use for status indicators',
      colors: [
        { name: 'success-50', class: 'bg-success-50', textClass: 'text-success-700' },
        { name: 'success-500', class: 'bg-success-500', textClass: 'text-white' },
        { name: 'success-700', class: 'bg-success-700', textClass: 'text-white' },
        { name: 'warning-50', class: 'bg-warning-50', textClass: 'text-warning-700' },
        { name: 'warning-500', class: 'bg-warning-500', textClass: 'text-white' },
        { name: 'warning-700', class: 'bg-warning-700', textClass: 'text-white' },
        { name: 'error-50', class: 'bg-error-50', textClass: 'text-error-700' },
        { name: 'error-500', class: 'bg-error-500', textClass: 'text-white' },
        { name: 'error-700', class: 'bg-error-700', textClass: 'text-white' },
      ]
    }
  ];

  return (
    <div className="p-8 bg-neutral-50 dark:bg-neutral-900 min-h-screen">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-neutral-900 dark:text-neutral-100 mb-2">
          Community Time Sheets - Slate-Focused Color System
        </h1>
        <p className="text-neutral-600 dark:text-neutral-400 mb-8">
          This color system prioritizes slate colors for an easy-on-the-eyes experience while maintaining clear client branding capabilities.
        </p>
        
        {colorGroups.map((group, groupIndex) => (
          <div key={groupIndex} className="mb-12">
            <h2 className="text-2xl font-semibold text-neutral-800 dark:text-neutral-200 mb-2">
              {group.name}
            </h2>
            <p className="text-neutral-600 dark:text-neutral-400 mb-4">
              {group.description}
            </p>
            <div className="grid grid-cols-2 md:grid-cols-5 lg:grid-cols-10 gap-3">
              {group.colors.map((color, colorIndex) => (
                <div 
                  key={colorIndex}
                  className={`${color.class} ${color.textClass} p-4 rounded-lg text-center shadow-sm`}
                >
                  <div className="text-xs font-medium">
                    {color.name}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
        
        <div className="mt-12 p-6 bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700">
          <h3 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100 mb-4">
            Usage Examples
          </h3>
          <div className="space-y-4">
            <div className="p-4 bg-primary-500 text-white rounded-lg">
              <p className="font-medium">Primary Button (Client Brand)</p>
              <p className="text-sm opacity-90">bg-primary-500 text-white</p>
            </div>
            <div className="p-4 border-2 border-secondary-500 bg-secondary-50 text-secondary-700 rounded-lg">
              <p className="font-medium">Secondary Outline (Client Accent)</p>
              <p className="text-sm opacity-90">border-secondary-500 bg-secondary-50 text-secondary-700</p>
            </div>
            <div className="p-4 bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 rounded-lg">
              <p className="font-medium">Neutral Card (Universal)</p>
              <p className="text-sm opacity-90">bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300</p>
            </div>
            <div className="p-4 bg-success-500 text-white rounded-lg">
              <p className="font-medium">Success Status</p>
              <p className="text-sm opacity-90">bg-success-500 text-white</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ColorSystemDemo;
