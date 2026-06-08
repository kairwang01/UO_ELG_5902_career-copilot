import React from 'react';
import type { Session } from '@supabase/supabase-js';
import type { UserProfile } from '../../../types';
import JobPostForm from '../../JobPostForm';
import type { Database } from '../../../lib/supabaseClient';
import { PortalTopBar } from '../PortalTopBar';

type JobPosting = Database['public']['Tables']['job_postings']['Row'];

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
  JobPostForm renders as a full-screen modal overlay (fixed inset-0).
  We keep the portal's topbar visible underneath; the modal appears on top.
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
      />
    </>
  );
}
