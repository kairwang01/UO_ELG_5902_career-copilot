import React from 'react';

interface EmptyStateProps {
  // Defaults to a neutral marker; pass a lucide icon or emoji for context.
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: { label: string; onClick: () => void };
}

// Shared placeholder for views that have nothing to show yet (e.g. before a
// résumé is uploaded). Keeps the "nothing here yet" message and styling
// consistent across the workspace instead of each view inventing its own.
const EmptyState: React.FC<EmptyStateProps> = ({ icon = '📄', title, description, action }) => (
  <div className="flex flex-col items-center justify-center p-12 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 text-center animate-fade-in min-h-[60vh]">
    <div className="text-5xl mb-4">{icon}</div>
    <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">{title}</h3>
    <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto mb-6">{description}</p>
    {action && (
      <button
        onClick={action.onClick}
        className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-6 rounded-lg shadow-sm transition-colors"
      >
        {action.label}
      </button>
    )}
  </div>
);

export default EmptyState;
