import { useEffect, useState } from 'react';
import { data } from '../../lib/data';
import type { AppSession } from '../../lib/data';
import type { UserProfile } from '../../types';
import { adminCheckAccess } from '../../services/adminClient';

export interface SiteSessionState {
  /** Firebase auth session, or null when signed out. */
  session: AppSession | null;
  /** The signed-in user's profile (role / subscription), or null. */
  profile: UserProfile | null;
  /** True once we've resolved the initial auth state (avoids a logged-out flash). */
  ready: boolean;
  isAdmin: boolean;
  /** Employer role OR a business subscription plan. */
  isBusiness: boolean;
}

/**
 * Lightweight auth/role awareness for the marketing shell (header, home redirect).
 * Mirrors the role logic the in-app Header uses, without pulling in CareerApp state.
 */
export function useSiteSession(): SiteSessionState {
  const [session, setSession] = useState<AppSession | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [sessionResolved, setSessionResolved] = useState(false);
  const [profileSettled, setProfileSettled] = useState(false);

  useEffect(() => {
    let active = true;
    data.auth.getSession().then((s) => {
      if (!active) return;
      setSession(s);
      setSessionResolved(true);
      // No session means no profile fetch will happen — settle immediately.
      if (!s?.user) setProfileSettled(true);
    });
    const { unsubscribe } = data.auth.onAuthStateChange((_event, s) => {
      if (!active) return;
      setSession(s);
      setSessionResolved(true);
      if (!s?.user) {
        setProfileSettled(true);
      }
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    let active = true;
    if (!session?.user) {
      setProfile(null);
      setIsAdmin(false);
      // profileSettled is already set by the session effect for the no-session path.
      return;
    }
    // Reset settled flag while fetching for this user.
    setProfileSettled(false);
    data.profiles
      .get(session.user.id)
      .then((r) => {
        if (active) {
          setProfile(r.data ?? null);
          setProfileSettled(true);
        }
      })
      .catch(() => {
        if (active) {
          setProfile(null);
          setProfileSettled(true);
        }
      });
    adminCheckAccess()
      .then((r) => {
        if (active) setIsAdmin(!!r.admin);
      })
      .catch(() => {
        if (active) setIsAdmin(false);
      });
    return () => {
      active = false;
    };
  }, [session?.user?.id]);

  const isBusiness =
    profile?.role === 'employer' ||
    profile?.subscription_status === 'single_post' ||
    profile?.subscription_status === 'job_pack';

  const ready = sessionResolved && profileSettled;

  return { session, profile, ready, isAdmin, isBusiness };
}
