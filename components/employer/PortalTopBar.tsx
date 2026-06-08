import React from 'react';

interface PortalTopBarProps {
  title: string;
  darkMode?: boolean;
}

export function PortalTopBar({ title, darkMode = false }: PortalTopBarProps) {
  return (
    <div
      className={`h-16 border-b flex items-center px-8 flex-shrink-0 ${
        darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
      }`}
    >
      <h1 className={`text-xl font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>{title}</h1>
    </div>
  );
}
