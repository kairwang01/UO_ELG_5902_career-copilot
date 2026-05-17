
import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { supabase } from '../lib/supabaseClient';
import type { Session } from '@supabase/supabase-js';

interface CreditsContextType {
  credits: number;
  setCredits: (credits: number) => void;
  deductCredits: (amount: number, session: Session | null) => Promise<boolean>;
  addCredits: (amount: number, session: Session | null) => Promise<boolean>;
}

const CreditsContext = createContext<CreditsContextType | undefined>(undefined);

export const useCredits = () => {
  const context = useContext(CreditsContext);
  if (!context) {
    throw new Error('useCredits must be used within a CreditsProvider');
  }
  return context;
};

export const CreditsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [credits, setCredits] = useState(0);

  const deductCredits = useCallback(async (amount: number, session: Session | null) => {
    if (!session) {
      console.error("Deduct credits failed: No session provided.");
      return false;
    }
    
    // Bypass for specific user
    if (session.user?.email === 'abhishek.ip@gmail.com') {
      return true;
    }

    const newCredits = credits - amount;
    if (newCredits < 0) return false;

    setCredits(newCredits);
    const { error } = await supabase
      .from('profiles')
      .update({ credits: newCredits })
      .eq('id', session.user.id);

    if (error) {
      console.error("Error updating credits in DB:", error);
      // Revert state if DB update fails
      setCredits(credits);
      return false;
    }
    return true;
  }, [credits]);

  const addCredits = useCallback(async (amount: number, session: Session | null) => {
    if (!session) {
      console.error("Add credits failed: No session provided.");
      return false;
    }
    const newCredits = (credits || 0) + amount;

    setCredits(newCredits);
    const { error } = await supabase
      .from('profiles')
      .update({ credits: newCredits })
      .eq('id', session.user.id);

    if (error) {
      console.error("Error adding credits in DB:", error);
      setCredits(credits); // Revert
      return false;
    }
    return true;
  }, [credits]);


  return (
    <CreditsContext.Provider value={{ credits, setCredits, deductCredits, addCredits }}>
      {children}
    </CreditsContext.Provider>
  );
};
