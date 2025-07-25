import React from 'react';
import { useTheme } from '../context/ThemeContext';

// Placeholder component - will be rebuilt with Tailwind
const TimeSummaryDashboard = (props) => {
  return (
    <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 p-6">
      <h3 className="text-lg font-medium text-neutral-900 dark:text-neutral-100 mb-4">Dashboard</h3>
      <p className="text-neutral-600 dark:text-neutral-400">
        Dashboard component is being rebuilt with Tailwind CSS. 
        This is a placeholder for now.
      </p>
    </div>
  );
};

export default React.memo(TimeSummaryDashboard);