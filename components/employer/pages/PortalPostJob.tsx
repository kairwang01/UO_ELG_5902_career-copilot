import React from 'react';
import type { AppSession as Session } from '../../../lib/data';
import type { UserProfile } from '../../../types';
import JobPostForm from '../../JobPostForm';
import type { JobPosting } from '../../../lib/recruitingData';
import { PortalTopBar } from '../PortalTopBar';

interface PortalPostJobProps {
  session: Session;
  profile: UserProfile;
  darkMode: boolean;
  existingJob?: JobPosting | null;
  onSaved: () => void;
  onCancel: () => void;
  t: (key: string) => string;
}

/*
  Renders JobPostForm embedded in the portal page flow (no modal overlay).
  onClose → onCancel (navigate back), onPostCreated → onSaved (refresh + navigate).
*/
export function PortalPostJob({
  session,
  profile,
  darkMode,
  existingJob,
  onSaved,
  onCancel,
  t,
}: PortalPostJobProps) {
  return (
    <>
      <PortalTopBar title={existingJob ? 'Edit Job Posting' : 'Post a Job'} darkMode={darkMode} />
      <JobPostForm
        session={session}
        profile={profile}
        existingJob={existingJob ?? null}
        onClose={onCancel}
        onPostCreated={onSaved}
        t={t}
        embedded
      />
    </>
  );
}
