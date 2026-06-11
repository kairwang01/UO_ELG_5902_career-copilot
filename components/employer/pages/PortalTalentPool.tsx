import React from 'react';
import type { UserProfile } from '../../../types';
import TalentDiscovery from '../../TalentDiscovery';
import { PortalTopBar } from '../PortalTopBar';

interface PortalTalentPoolProps {
  profile: UserProfile;
  darkMode: boolean;
  onPostJob: () => void;
  navigateToBusinessPricing: () => void;
  t: (key: string) => string;
}

// Reuses TalentDiscovery which fetches Firebase candidate profiles and runs matching.
export function PortalTalentPool({ profile, darkMode, onPostJob, navigateToBusinessPricing, t }: PortalTalentPoolProps) {
  return (
    <>
      <PortalTopBar title={t('portal_nav_discover')} darkMode={darkMode} />
      <div className={`max-w-[1088px] mx-auto p-8 animate-view-fade ${darkMode ? 'text-white' : ''}`}>
        <TalentDiscovery
          t={t}
          profile={profile}
          onPostJob={onPostJob}
          navigateToBusinessPricing={navigateToBusinessPricing}
        />
      </div>
    </>
  );
}
