import React, { createContext, useContext, useState, ReactNode } from 'react';

interface SettingsContextType {
  isAIMode: boolean;
  toggleAIMode: () => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};

export const SettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isAIMode, setIsAIMode] = useState(() => {
    const saved = localStorage.getItem('aiModeEnabled');
    return saved !== null ? saved === 'true' : true;
  });

  const toggleAIMode = () => {
    setIsAIMode((prev) => {
      const newState = !prev;
      localStorage.setItem('aiModeEnabled', String(newState));
      return newState;
    });
  };

  return (
    <SettingsContext.Provider value={{ isAIMode, toggleAIMode }}>
      {children}
    </SettingsContext.Provider>
  );
};
