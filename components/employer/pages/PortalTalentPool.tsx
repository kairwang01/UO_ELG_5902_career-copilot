import React from 'react';
import type { UserProfile } from '../../../types';
import TalentDiscovery from '../../TalentDiscovery';
import { PortalTopBar } from '../PortalTopBar';

interface PortalTalentPoolProps {
  profile: UserProfile;
  darkMode: boolean;
  navigateToBusinessPricing: () => void;
  t: (key: string) => string;
}

// Reuses TalentDiscovery which fetches real Supabase candidates and runs Gemini matching.
export function PortalTalentPool({ profile, darkMode, navigateToBusinessPricing, t }: PortalTalentPoolProps) {
  return (
    <>
      <PortalTopBar title="Discover Talent" darkMode={darkMode} />
      <div className={`max-w-[1088px] mx-auto p-8 ${darkMode ? 'text-white' : ''}`}>
        <TalentDiscovery t={t} profile={profile} navigateToBusinessPricing={navigateToBusinessPricing} />
      </div>
    </>
  );
}
