import React from 'react';
import type { AppSession as Session } from '../../../lib/data';
import Account from '../../Account';
import { PortalTopBar } from '../PortalTopBar';

interface PortalAccountSettingsProps {
  session: Session;
  darkMode: boolean;
  t: (key: string) => string;
}

// Embeds the real Account component (password, profile photo, Web3, API keys, sign out).
// onSetView is a no-op here since we handle navigation in the portal shell.
export function PortalAccountSettings({
  session,
  darkMode,
  t,
}: PortalAccountSettingsProps) {
  return (
    <>
      <PortalTopBar title={t('portal_nav_account')} darkMode={darkMode} />
      <div className="max-w-[1088px] mx-auto p-8">
        <Account
          key={session.user.id}
          session={session}
          // Account uses onSetView only to navigate to api_docs or back to home.
          // In the portal context these are no-ops; the user stays in the portal.
          onSetView={() => {}}
          t={t}
        />
      </div>
    </>
  );
}
