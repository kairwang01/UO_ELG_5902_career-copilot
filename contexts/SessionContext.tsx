import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { data } from '../lib/data';
import type { AppSession } from '../lib/data';
import type { UserProfile } from '../types';
import { adminCheckAccess } from '../services/adminClient';
import { hasBusinessPortalAccess } from '../lib/access/businessAccess';

export interface SiteSessionState {
  /** Firebase auth session, or null when signed out. */
  session: AppSession | null;
  /** The signed-in user's profile (role / subscription), or null. */
  profile: UserProfile | null;
  /** True once we've resolved the initial auth state (avoids a logged-out flash). */
  ready: boolean;
  /**
   * True once the FIRST session value (logged-in or out) has resolved — earlier than
   * `ready`, which also waits for profile + admin. Consumers that must react to
   * sign-in/out transitions (not just first paint) gate on this so they don't treat
   * the provider's transient initial null as a sign-out.
   */
  sessionResolved: boolean;
  isAdmin: boolean;
  /** Employer role OR a business subscription plan. */
  isBusiness: boolean;
  /**
   * Re-fetch the signed-in user's profile (subscription / credits). The profile is
   * otherwise only loaded once per login, so callers must invoke this after an
   * out-of-band change to it — e.g. returning from Stripe checkout, where the
   * webhook provisions the new plan server-side and the UI would otherwise stay
   * stale until a full reload.
   */
  refreshProfile: () => Promise<void>;
}

const SessionContext = createContext<SiteSessionState | undefined>(undefined);

/**
 * Single source of session / profile / role for the whole app.
 *
 * Previously every marketing surface (SiteHeader, SiteMobileNav, JobseekerHomePage,
 * PricingPage) called the useSiteSession HOOK independently, so a single login fired
 * N parallel `users/{uid}` reads, each settling its own `ready` flag on its own clock
 * — the race behind the recurring redirect mismatches. Lifting the identical logic
 * into ONE provider gives every consumer the same settled state from a single read.
 *
 * The derivations (`ready` / `isBusiness` / `isAdmin`) are preserved VERBATIM from the
 * old hook, so routing decisions that read them are unchanged — only the data source
 * is consolidated.
 */
export const SessionProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<AppSession | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [sessionResolved, setSessionResolved] = useState(false);
  const [profileSettled, setProfileSettled] = useState(false);
  const [adminSettled, setAdminSettled] = useState(true);

  useEffect(() => {
    let active = true;
    data.auth.getSession().then((s) => {
      if (!active) return;
      setSession(s);
      setSessionResolved(true);
      // No session means no profile fetch will happen — settle immediately.
      if (!s?.user) {
        setProfileSettled(true);
        setAdminSettled(true);
      }
    });
    const { unsubscribe } = data.auth.onAuthStateChange((_event, s) => {
      if (!active) return;
      setSession(s);
      setSessionResolved(true);
      if (!s?.user) {
        setProfileSettled(true);
        setAdminSettled(true);
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
      setAdminSettled(true);
      // profileSettled is already set by the session effect for the no-session path.
      return;
    }
    // Reset settled flag while fetching for this user.
    setProfileSettled(false);
    setAdminSettled(false);
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
      })
      .finally(() => {
        if (active) setAdminSettled(true);
      });
    return () => {
      active = false;
    };
  }, [session?.user?.id]);

  const refreshProfile = useCallback(async (): Promise<void> => {
    const uid = session?.user?.id;
    if (!uid) return;
    try {
      const r = await data.profiles.get(uid);
      // Guard against a logout/user-switch landing a stale fetch onto the new state.
      setProfile((prev) => (uid === session?.user?.id ? (r.data ?? null) : prev));
    } catch {
      /* keep the existing profile on a transient failure */
    }
  }, [session?.user?.id]);

  const isBusiness = hasBusinessPortalAccess(profile?.role, profile?.subscription_status);
  const ready = sessionResolved && profileSettled && adminSettled;

  return (
    <SessionContext.Provider value={{ session, profile, ready, sessionResolved, isAdmin, isBusiness, refreshProfile }}>
      {children}
    </SessionContext.Provider>
  );
};

/** Read the shared session state. Must be used within <SessionProvider>. */
export function useSession(): SiteSessionState {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return ctx;
}
