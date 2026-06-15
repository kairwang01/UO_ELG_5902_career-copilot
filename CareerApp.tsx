

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { BarChart3 } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import type { AnalysisResult, ResumeImage, UserProfile } from './types';
import { analyzeResume, setApiStatusUpdater, setAiModel } from './services/aiClient';
import { ALL_PLANS, BUSINESS_PLANS, DEFAULT_MARKET } from './config';
import { doc, onSnapshot } from 'firebase/firestore';
import { firestoreDb } from './lib/firebaseClient';
import { data, type AppSession as Session } from './lib/data';
import { logToolUsage, logResumeAnalysis } from './lib/analytics';
import { setUserSubscription } from './services/subscriptionClient';
import { useLocalization } from './hooks/useLocalization';
import { ToastProvider, useToast } from './components/Toast';
import { useCredits } from './contexts/CreditsContext';
import { useApiStatus } from './contexts/ApiStatusContext';
import { useModalBehavior } from './hooks/useModalBehavior';
import ApiStatusBanner from './components/ApiStatusBanner';
import CreditModal from './components/modals/CreditModal';
import { INITIAL_USER_CREDITS, TOOL_CREDIT_COSTS } from './config/credits';

import CookieConsent from './components/CookieConsent';
import UploadSection from './components/UploadSection';
import EmptyState from './components/EmptyState';
import AnalysisDisplay from './components/AnalysisDisplay';
import LoadingSpinner from './components/LoadingSpinner';
import StagedLoader from './components/StagedLoader';
import Auth from './components/Auth';
import Account from './components/Account';
import Dashboard from './components/dashboard/Dashboard';
import {
  CandidateBillingPage,
  CareerPlanPage,
  InterviewPracticePage,
  JobMatchPage,
  ResumeReadinessPage,
} from './components/dashboard/CandidateWorkspacePages';
import Sidebar from './components/Sidebar';
import MyApplications from './components/MyApplications';
import AccountMenu from './components/AccountMenu';
import type { PortalPage } from './components/employer/EmployerPortal';
import CareerCoachBot from './components/CareerCoachBot';
import VerifiedTalentSection from './components/VerifiedTalentSection';
import ApiDocsViewer from './components/ApiDocsViewer';
import { SiteLayout } from './marketing/components/SiteLayout';
import { isWeb3Enabled, onWeb3FlagChange } from './config/featureFlags';
import OnboardingFlow from './components/onboarding/OnboardingFlow';
import WorkspaceTour from './components/onboarding/WorkspaceTour';
import { isOnboardingDue, isTourDone, loadPendingOnboardingName, markTourDone } from './lib/onboarding';
import './marketing/site-theme.css';

const BusinessPage = React.lazy(() => import('./components/BusinessPage'));
const EmployerPortal = React.lazy(() =>
  import('./components/employer/EmployerPortal').then((module) => ({
    default: module.EmployerPortal,
  })),
);
const AgencyHub = React.lazy(() => import('./components/AgencyHub'));

interface AppContentProps {
  entry?: 'workspace' | 'portal';
}

type DashboardView =
  | 'dashboard' | 'toolkit' | 'resume' | 'jobs' | 'applications'
  | 'interview' | 'plan' | 'portfolio' | 'billing' | 'account' | 'credentials';
type CandidatePlanKey = 'free' | 'essentials' | 'accelerator' | 'executive';

// Breadcrumb i18n keys for the workspace header (mirrors Sidebar labels).
const DASHBOARD_VIEW_LABEL_KEYS: Record<DashboardView, string> = {
  dashboard: 'ws_nav_dashboard',
  toolkit: 'ws_nav_toolkit',
  resume: 'ws_nav_resume',
  jobs: 'ws_nav_jobs',
  applications: 'ws_nav_applications',
  interview: 'ws_nav_interview',
  plan: 'ws_nav_plan',
  portfolio: 'ws_nav_portfolio',
  billing: 'ws_nav_billing',
  account: 'ws_nav_account',
  credentials: 'ws_nav_credentials',
};

const buildLocalProfile = (
  userId: string,
  patch: Partial<UserProfile>,
): UserProfile => ({
  id: userId,
  updated_at: new Date().toISOString(),
  full_name: null,
  avatar_url: null,
  subscription_status: 'free',
  role: 'candidate',
  company_name: null,
  company_website: null,
  company_description: null,
  company_logo_url: null,
  resume_text: null,
  preferred_language: null,
  wallet_address: null,
  nft_minted: null,
  nft_staked: null,
  nft_earnings: null,
  nft_token_id: null,
  english_pro_streak: null,
  english_pro_last_practice: null,
  credits: INITIAL_USER_CREDITS,
  ...patch,
});

const AppContent: React.FC<AppContentProps> = ({ entry = 'workspace' }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [view, setView] = useState<'home' | 'auth' | 'account' | 'business' | 'agency' | 'api_docs'>('home');
  const [initialAuthView, setInitialAuthView] = useState<'sign_in' | 'sign_up' | 'forgot_password'>('sign_in');
  const [authMode, setAuthMode] = useState<'candidate' | 'business'>('candidate');

  const [resumeText, setResumeText] = useState<string>('');
  const [resumeImages, setResumeImages] = useState<ResumeImage[] | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [market, setMarket] = useState<string>(DEFAULT_MARKET);
  const [isRedirecting, setIsRedirecting] = useState<boolean>(false);
  const [isUpdatingResume, setIsUpdatingResume] = useState(false);
  const [showHomePageOverride, setShowHomePageOverride] = useState(false);
  const [isProfileLoaded, setIsProfileLoaded] = useState(false);
  const [dashboardView, setDashboardView] = useState<DashboardView>('dashboard');
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [candidatePlanSaving, setCandidatePlanSaving] = useState<CandidatePlanKey | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  // Deep-link target page for the employer hiring portal
  const [portalInitialPage, setPortalInitialPage] = useState<PortalPage>('dashboard');
  // Experimental Web3 module flag — gates the Identity & Wallet view.
  const [web3Enabled, setWeb3Enabled] = useState(isWeb3Enabled());
  // Post-signup guided setup + one-time workspace tour (candidates only).
  const [onboardingActive, setOnboardingActive] = useState(false);
  const [showTour, setShowTour] = useState(false);
  const roleStateKeyRef = useRef<string | null>(null);
  const resumeSaveWarningShownRef = useRef(false);

  const { credits, setCredits, deductCredits } = useCredits();
  const { addToast } = useToast();
  const [isCreditModalOpen, setIsCreditModalOpen] = useState(false);
  const analysisCost = TOOL_CREDIT_COSTS['resume-analysis'];

  const { t, isLoaded: isLangLoaded, currentLang, changeLanguage } = useLocalization();
  const { setApiStatus, setLastError } = useApiStatus();
  const isPortalEntry = entry === 'portal';
  const isCandidate = profile?.role === 'candidate';
  const isEmployer = profile?.role === 'employer';
  const isKnownWorkspaceRole = isCandidate || isEmployer || profile?.role === 'agency';
  const closeMobileNav = useCallback(() => setIsMobileNavOpen(false), []);
  useModalBehavior(closeMobileNav, isMobileNavOpen);

  // Keep the Web3 flag in sync and bounce off the credentials view if the
  // module is switched off while the user is on it.
  useEffect(() => onWeb3FlagChange(setWeb3Enabled), []);

  // Open the guided setup once for freshly-registered candidates (the pending
  // marker is set by the sign-up form; completion clears it permanently).
  useEffect(() => {
    if (session?.user && isProfileLoaded && isCandidate && isOnboardingDue(session.user.id)) {
      setOnboardingActive(true);
    }
  }, [session, isProfileLoaded, isCandidate]);
  useEffect(() => {
    if (!web3Enabled && dashboardView === 'credentials') setDashboardView('dashboard');
  }, [web3Enabled, dashboardView]);

  useEffect(() => {
    setApiStatusUpdater((status, errorMsg) => {
        setApiStatus(status);
        if (errorMsg) {
            setLastError(errorMsg);
        }
    });
  }, [setApiStatus, setLastError]);


  const uploadSectionRef = useRef<HTMLDivElement>(null);
  // True after Firebase fires its first onAuthStateChanged (persisted session known).
  const [authHydrated, setAuthHydrated] = useState(false);
  // Tracks the signed-in user so token refreshes / tab refocus don't reset the view.
  const currentUserIdRef = useRef<string | null>(null);
  
  // Initialize theme from localStorage or system preference
  useEffect(() => {
    const storedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null;
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const initialTheme = storedTheme || (systemPrefersDark ? 'dark' : 'light');
    setTheme(initialTheme);
  }, []);

  // Apply theme class to HTML element and persist changes
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove(theme === 'dark' ? 'light' : 'dark');
    root.classList.add(theme);
    try { localStorage.setItem('theme', theme); } catch { /* storage unavailable */ }
  }, [theme]);
  
  const toggleTheme = () => {
    setTheme(prevTheme => prevTheme === 'light' ? 'dark' : 'light');
  };

  useEffect(() => {
    // Honour ?auth=signin|signup|forgot on the /workspace surface. Reads react-router's
    // reactive location.search (NOT window.location) and depends on it, so clicking the
    // header "Sign In" link AGAIN — e.g. after signing out while still mounted on
    // /workspace — re-opens the auth view. (Previously a one-shot ref + non-reactive
    // window.location.search meant the second click did nothing.)
    //
    // Wait for Firebase to restore a persisted session first: a returning, already
    // signed-in user must not be shown the modal (session guard below).
    if (entry !== 'workspace' || !authHydrated || session) return;

    const auth = new URLSearchParams(location.search).get('auth');
    if (auth !== 'signin' && auth !== 'signup' && auth !== 'forgot') return;

    setAuthMode('candidate');
    setInitialAuthView(auth === 'signup' ? 'sign_up' : auth === 'forgot' ? 'forgot_password' : 'sign_in');
    setView('auth');
    // Strip the query via react-router so location.search stays in sync and a refresh
    // doesn't reopen the modal; this re-runs the effect, which then no-ops (no param).
    navigate(location.pathname, { replace: true });
  }, [entry, session, authHydrated, location.search, location.pathname, navigate]);

  // Close the auth modal as soon as a session exists (login success or async restore).
  useEffect(() => {
    if (session?.user && view === 'auth') {
      setView('home');
    }
  }, [session, view]);

  // Effect to determine and set the UI language based on user preferences or browser settings
  useEffect(() => {
    const storedLang = localStorage.getItem('preferred_language');
    const profileLang = profile?.preferred_language;
    const browserLang = navigator.language.split('-')[0];
    const targetLang = storedLang || profileLang || browserLang || 'en';

    if (targetLang && targetLang !== currentLang) {
        changeLanguage(targetLang);
    }
  }, [profile, currentLang, changeLanguage]);


  // Debounced effect to save resume text to the database (candidates only — employers have no resume)
  useEffect(() => {
    if (session && isProfileLoaded && profile?.role === 'candidate') {
      const handler = setTimeout(async () => {
        if (!session.user) return;
        const showResumeSaveWarning = () => {
          if (resumeSaveWarningShownRef.current) return;
          resumeSaveWarningShownRef.current = true;
          addToast(t('dashboard_resume_save_warning'), 'info');
        };
        try {
          const { error } = await data.profiles.update(session.user.id, { resume_text: resumeText });
          if (error) {
            showResumeSaveWarning();
          }
        } catch {
          showResumeSaveWarning();
        }
      }, 1500);

      return () => {
        clearTimeout(handler);
      };
    }
  }, [resumeText, session, isProfileLoaded, profile?.role, addToast, t]);


  const getProfile = useCallback(async () => {
    try {
      if (!session?.user) return;
      const user = session.user;

      const { data: profileData, error } = await data.profiles.get(user.id);

      if (error && !error.message.includes('not found') && !error.message.includes('not-found')) {
        // Real Firestore error (e.g. permission-denied) — surface it.
        throw new Error(error.message);
      }

      const applyProfile = async (p: UserProfile | null) => {
        if (!p) return;
        setProfile(p);
        setResumeText(p.role === 'candidate' ? p.resume_text || '' : '');

        const userCredits = p.credits || 0;
        setCredits(userCredits);

        const pendingPlan = sessionStorage.getItem('pending_plan');
        const pendingMode = sessionStorage.getItem('pending_mode');
        if (!pendingMode) return;

        sessionStorage.removeItem('pending_plan');
        sessionStorage.removeItem('pending_mode');

        try {
          const role: 'candidate' | 'employer' | 'agency' =
            pendingMode === 'business' ? 'employer' : 'candidate';

          if (pendingPlan) {
            const planKey = pendingMode === 'business'
              ? `pending_biz_${pendingPlan}`
              : pendingPlan === 'free' ? 'free' : `pending_${pendingPlan}`;
            // Carry the OAuth display name so it persists even if the doc is
            // created by this call rather than the onUserCreated trigger.
            await setUserSubscription(planKey, {
              fullName: user.user_metadata?.full_name || loadPendingOnboardingName(),
            });
          }

          if (p.role !== role) {
            await data.profiles.update(user.id, { role });
          }

          const { data: refreshed } = await data.profiles.get(user.id);
          if (refreshed) {
            setProfile(refreshed);
            setCredits(refreshed.credits || userCredits);
          }
        } catch (planErr) {
          addToast(`Could not apply your selected plan yet: ${(planErr as Error).message}`, 'error');
        }
      };

      if (profileData) {
        await applyProfile(profileData);
      } else {
        // Profile not found — onUserCreated trigger may still be in flight.
        // Retry after 1.5s before giving up.
        await new Promise(r => setTimeout(r, 1500));
        const { data: retryData } = await data.profiles.get(user.id);
        if (retryData) {
          await applyProfile(retryData);
        } else {
          const pendingPlan = sessionStorage.getItem('pending_plan');
          const pendingMode = sessionStorage.getItem('pending_mode');
          const role: 'candidate' | 'employer' = pendingMode === 'business' ? 'employer' : 'candidate';
          const subscriptionStatus = pendingPlan
            ? pendingMode === 'business'
              ? `pending_biz_${pendingPlan}`
              : pendingPlan === 'free' ? 'free' : `pending_${pendingPlan}`
            : 'free';
          const pendingOnboardingName = loadPendingOnboardingName();
          const now = new Date().toISOString();
          const fallbackProfile = buildLocalProfile(user.id, {
            full_name: user.user_metadata?.full_name || pendingOnboardingName || '',
            avatar_url: user.user_metadata?.avatar_url || null,
            subscription_status: subscriptionStatus,
            resume_text: '',
            role,
            credits: INITIAL_USER_CREDITS,
            updated_at: now,
            english_pro_streak: 0,
          });

          const { error: createError } = await data.profiles.upsert({
            id: user.id,
            full_name: fallbackProfile.full_name,
            avatar_url: fallbackProfile.avatar_url,
            subscription_status: fallbackProfile.subscription_status,
            resume_text: '',
            role: fallbackProfile.role,
            credits: INITIAL_USER_CREDITS,
            english_pro_streak: 0,
            created_at: now,
            updated_at: now,
          });
          if (createError) throw new Error(createError.message);

          sessionStorage.removeItem('pending_plan');
          sessionStorage.removeItem('pending_mode');
          await applyProfile(fallbackProfile);
        }
      }
    } catch {
      setError("Could not load your profile. Please try again later.");
    } finally {
        setIsProfileLoaded(true);
    }
  }, [session, setCredits, addToast]);

  // Employers render in their own dashboard shell (see the employer branch in the
  // main layout), so no default-view redirect is needed here.
  
  const handleSubscriptionRedirect = useCallback(async (planKey: string) => {
    if (!session) {
      setView('auth');
      return;
    }

    setIsRedirecting(true);

    try {
        let targetPlanKey = planKey;
        let plan;
        const isBiz = planKey.startsWith('pending_biz_');

        if (isBiz) {
            targetPlanKey = planKey.replace('pending_biz_', '');
            plan = BUSINESS_PLANS[targetPlanKey as keyof typeof BUSINESS_PLANS];
        } else if (planKey.startsWith('pending_')) {
            targetPlanKey = planKey.replace('pending_', '');
            plan = ALL_PLANS[targetPlanKey];
        } else {
            throw new Error(`Invalid pending plan key format: ${planKey}`);
        }

        const stripeReady = plan?.stripeLink && !plan.stripeLink.includes('/test_');

        if (stripeReady) {
            const stripeUrl = new URL(plan.stripeLink!);
            stripeUrl.searchParams.append('client_reference_id', session.user.id);
            if (session.user.email) {
                stripeUrl.searchParams.append('prefilled_email', session.user.email);
            }

            setTimeout(() => {
                window.open(stripeUrl.toString(), '_blank');
                setIsRedirecting(false);
            }, 1500);
        } else {
            await setUserSubscription(planKey);

            if (isBiz) {
                await data.profiles.update(session.user.id, { role: 'employer' });
            }

            await getProfile();
            setIsRedirecting(false);
        }
    } catch (error) {
        setError(`Error preparing for checkout: ${(error as Error).message}`);
        setIsRedirecting(false);
    }
  }, [session, getProfile]);

  const handleBusinessPlanSelection = async (planKey: string) => {
    if (!session) return;
    try {
      await setUserSubscription(`pending_biz_${planKey}`);
      await getProfile();
    } catch (error) {
      addToast(`Failed to set plan: ${(error as Error).message}`, 'error');
    }
  };

  const handleCandidatePlanSelection = async (planKey: CandidatePlanKey) => {
    if (!session || candidatePlanSaving) return;
    setCandidatePlanSaving(planKey);
    try {
      await setUserSubscription(planKey === 'free' ? 'free' : `pending_${planKey}`);
      await getProfile();
      addToast(t('portal_toast_plan_updated'), 'success');
    } catch (error) {
      addToast(t('portal_toast_plan_update_failed').replace('{error}', (error as Error).message), 'error');
    } finally {
      setCandidatePlanSaving(null);
    }
  };

  useEffect(() => {
    data.auth.getSession().then((session) => {
      currentUserIdRef.current = session?.user?.id ?? null;
      setSession(session);
    });

    const { unsubscribe } = data.auth.onAuthStateChange((_event, session) => {
      setAuthHydrated(true);

      const newUserId = session?.user?.id ?? null;
      const userChanged = newUserId !== currentUserIdRef.current;
      currentUserIdRef.current = newUserId;

      setSession(session);

      if (_event === 'SIGNED_OUT') {
        setView('home');
        setProfile(null);
        setAnalysisResult(null);
        setResumeText('');
        setOnboardingActive(false);
        setShowTour(false);
        setCredits(0);
        sessionStorage.clear();
        try {
          localStorage.removeItem('preferred_ai_model');
        } catch { /* storage unavailable */ }
        setAiModel(undefined);
        return;
      }

      // Only reset the view and reload on a genuine new sign-in. Token refreshes
      // and tab refocus fire SIGNED_IN with the same user, so we skip those to keep
      // the user on their current page.
      if (userChanged) {
        setIsProfileLoaded(false);
        if (_event === 'SIGNED_IN') {
          const urlParams = new URLSearchParams(window.location.search);
          if (urlParams.get('payment_success') === 'true') {
            addToast('Payment successful — your plan has been upgraded.', 'success');
            window.history.replaceState({}, document.title, window.location.pathname);
          }
          setView('home');
        }
      }
    });

    return () => unsubscribe();
  }, [setCredits]);

  // Live profile sync: credits deducted server-side, tier changes from the admin
  // portal, and payment upgrades appear without a re-login.
  useEffect(() => {
    const uid = session?.user?.id;
    if (!uid) return;
    const unsub = onSnapshot(
      doc(firestoreDb, 'users', uid),
      (snap) => {
        if (!snap.exists()) return;
        const p = { id: uid, ...snap.data() } as UserProfile;
        setProfile(p);
        if (typeof p.credits === 'number') setCredits(p.credits);
      },
      () => {
        addToast('Profile updates are temporarily unavailable. Refresh if account details look stale.', 'info');
      }
    );
    return () => unsub();
  }, [session?.user?.id, setCredits, addToast]);

  useEffect(() => {
    if (!session || (session && isProfileLoaded && !isCandidate)) {
        setIsUpdatingResume(false);
    }
  }, [session, isProfileLoaded, isCandidate]);

  useEffect(() => {
    const roleKey = `${session?.user?.id ?? 'signed-out'}:${profile?.role ?? 'no-role'}`;
    if (roleStateKeyRef.current === roleKey) return;
    roleStateKeyRef.current = roleKey;

    setDashboardView('dashboard');
    setActiveTool(null);
    setAnalysisResult(null);
    setResumeImages(null);
    setIsUpdatingResume(false);

    if (profile?.role === 'candidate') {
      setPortalInitialPage('dashboard');
    }
  }, [session?.user?.id, profile?.role]);


  useEffect(() => {
    const handleStripeRedirect = () => {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('payment_cancelled') === 'true') {
            addToast('Payment cancelled. You can try again anytime from the pricing page.', 'info');
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    };
    if (session) { getProfile(); }
    handleStripeRedirect();
  }, [session, getProfile]);
  
  useEffect(() => {
    if (profile?.subscription_status && (profile.subscription_status.startsWith('pending_') || profile.subscription_status.startsWith('pending_biz_'))) {
      const hasRedirected = sessionStorage.getItem(`${profile.subscription_status}_redirect_triggered`);
      if (!hasRedirected) {
        sessionStorage.setItem(`${profile.subscription_status}_redirect_triggered`, 'true');
        handleSubscriptionRedirect(profile.subscription_status);
      }
    }
  }, [profile, handleSubscriptionRedirect]);

  const navigateToPricing = () => {
    // The app only ever mounts inside the marketing shell (SiteRouter), so pricing
    // lives on its own route — no in-page scroll target anymore.
    setAnalysisResult(null);
    navigate('/pricing');
  };
  
  const navigateToBusinessPricing = () => {
    navigate('/pricing?from=business-upsell');
  };
  const navigateToAccount = () => { setShowHomePageOverride(false); setView('account'); };

  const handleSetView = (view: 'home' | 'auth' | 'account' | 'business' | 'agency' | 'api_docs', authView: 'sign_in' | 'sign_up' | 'forgot_password' = 'sign_in', mode: 'candidate' | 'business' = 'candidate') => {
    // A signed-in user has no use for the auth modal: opening it just flashes and is
    // instantly closed again by the "session exists" effect, which reads as a frozen,
    // unresponsive click (e.g. a logged-in candidate pressing "Enter Portal" on the
    // employer page). Skip the dead modal; send a non-employer who wants the business
    // side to the upgrade flow instead (selecting a business plan promotes them to
    // employer), and otherwise just no-op.
    if (view === 'auth' && session) {
      if (mode === 'business' && !isEmployer) { navigateToBusinessPricing(); }
      return;
    }
    if (view !== 'home') { setShowHomePageOverride(false); }
    else { setDashboardView('dashboard'); setShowHomePageOverride(false); }
    if (view === 'auth') { setInitialAuthView(authView); setAuthMode(mode); }
    setView(view);
  };


  const userPlan = profile?.subscription_status || 'free';

  const performAnalysis = async () => {
    if (!resumeText.trim() && (!resumeImages || resumeImages.length === 0)) {
      setError('Please provide your resume before analyzing.');
      return;
    }
    setIsLoading(true);
    setError(null);
    setAnalysisResult(null);

    try {
      const success = await deductCredits(analysisCost, session);
      if (!success) {
          throw new Error("Credit deduction failed. Please check your balance.");
      }
      
      const result = await analyzeResume(resumeText, resumeImages, market);
      
      if (session?.user) {
        try {
            const eventId = await logToolUsage(session.user.id, 'resume-analysis', { market });
            await logResumeAnalysis(session.user.id, eventId, {
              score: result.score,
              market_name: market,
              summary: result.summary,
              strengths: result.strengths,
              improvements: result.improvements,
              keywords: result.keywords,
            });
        } catch {
            addToast('Analysis finished, but the activity history could not be updated.', 'info');
        }
      }
      
      setAnalysisResult(result);
      if (result.extractedText) {
          setResumeText(result.extractedText);
      }
      setIsUpdatingResume(false);

    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unknown error occurred.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleInitiateAnalysis = (e: React.FormEvent) => {
      e.preventDefault();
      if (!session) {
          handleSetView('auth', 'sign_up');
          return;
      }
      setIsCreditModalOpen(true);
  };
  
  const handleReset = () => {
    setAnalysisResult(null);
    setError(null);
    setResumeImages(null);
    setShowHomePageOverride(false);
    setDashboardView('dashboard');
  };

  const handleApplyImprovements = (newText: string) => {
    setResumeText(newText);
    handleReset();
  };

  const uploadVariant = 'site' as const;

  const renderAppEntry = () => (
    <>
      <div className="text-center mb-8 sm:mb-10 max-w-2xl mx-auto">
        <h1 className="text-[clamp(1.5rem,3vw,2.25rem)] font-semibold tracking-tight text-[var(--site-text)] mb-3">
          {t('site_app_entry_title')}
        </h1>
        <p className="text-[var(--site-text-muted)]">
          {t('site_app_entry_subtitle')}
        </p>
      </div>
      <div id="upload-section" ref={uploadSectionRef} className="scroll-mt-20">
        <UploadSection
          t={t}
          resumeText={resumeText}
          setResumeText={setResumeText}
          resumeImages={resumeImages}
          setResumeImages={setResumeImages}
          onInitiateAnalysis={handleInitiateAnalysis}
          isLoading={isLoading}
          error={error}
          setError={setError}
          market={market}
          setMarket={setMarket}
          variant={uploadVariant}
        />
      </div>
    </>
  );

  const renderPortalEntry = () => (
    <React.Suspense fallback={<LoadingSpinner market={market} />}>
      <BusinessPage
        t={t}
        session={session}
        profile={profile}
        onSelectBusinessPlan={handleBusinessPlanSelection}
        onBack={() => navigate('/employers')}
        onEnterPortal={(page) => {
          setPortalInitialPage(page);
          if (isEmployer) {
            handleSetView('home');
          } else {
            handleSetView('auth', 'sign_in', 'business');
          }
        }}
        refreshProfile={getProfile}
        authHydrated={authHydrated}
      />
    </React.Suspense>
  );

  const renderWorkspaceBody = () => (
    <section className="py-10 sm:py-14">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <ApiStatusBanner />
        {isPortalEntry ? renderPortalEntry() : renderContent()}
      </div>
    </section>
  );

  const openWorkspaceTool = (tool: string) => {
    setActiveTool(tool);
    setDashboardView('toolkit');
  };

  const openResumeUpload = () => {
    setActiveTool(null);
    setDashboardView('resume');
    setIsUpdatingResume(true);
  };

  const renderDashboard = () => (
    // key replays the entrance animation on every view switch — quick fade keeps
    // navigation feeling responsive instead of content snapping in place.
    <div key={dashboardView} className="flex flex-col gap-6 animate-view-fade">
        {dashboardView === 'dashboard' && (
            <div id="dashboard-panel">
              <Dashboard
                session={session}
                profile={profile}
                t={t}
                hasResume={!!resumeText.trim()}
                onNavigate={(nextView) => {
                  setDashboardView(nextView);
                  if (nextView === 'resume' && !resumeText.trim()) setIsUpdatingResume(true);
                }}
              />
            </div>
        )}
        
        {dashboardView === 'toolkit' && (
            <div id="toolkit-panel">
                {!resumeText ? (
                    <EmptyState
                        title={t('ws_toolkit_empty_title')}
                        description={t('ws_toolkit_empty_desc')}
                        action={{ label: t('ws_upload_resume'), onClick: () => { setActiveTool(null); setDashboardView('resume'); setIsUpdatingResume(true); } }}
                    />
                ) : (
                    <AnalysisDisplay
                        t={t}
                        result={null}
                        onReset={handleReset}
                        resumeText={resumeText}
                        userPlan={userPlan}
                        market={market}
                        navigateToPricing={navigateToPricing}
                        session={session}
                        profile={profile}
                        refreshProfile={getProfile}
                        onApplyImprovements={handleApplyImprovements}
                        activeTool={activeTool}
                        setActiveTool={setActiveTool}
                    />
                )}
            </div>
        )}
        
        {dashboardView === 'resume' && (
            <div id="resume-panel">
              <ResumeReadinessPage
                resumeText={resumeText}
                market={market}
                t={t}
                onUploadResume={openResumeUpload}
                onOpenTool={openWorkspaceTool}
                onViewChange={setDashboardView}
              />
            </div>
        )}

        {dashboardView === 'jobs' && (
            <div id="jobs-panel">
              <JobMatchPage
                resumeText={resumeText}
                market={market}
                t={t}
                onUploadResume={openResumeUpload}
                onOpenTool={openWorkspaceTool}
                onViewChange={setDashboardView}
                session={session}
              />
            </div>
        )}

        {dashboardView === 'applications' && (
          <div id="applications-panel">
            <MyApplications
              session={session}
              t={t}
              onFindSimilar={() => {
                setActiveTool('opportunity-finder');
                setDashboardView('toolkit');
              }}
            />
          </div>
        )}

        {dashboardView === 'interview' && (
            <div id="interview-panel">
              <InterviewPracticePage
                resumeText={resumeText}
                market={market}
                t={t}
                onUploadResume={openResumeUpload}
                onOpenTool={openWorkspaceTool}
                onViewChange={setDashboardView}
              />
            </div>
        )}

        {dashboardView === 'plan' && (
            <div id="plan-panel">
              <CareerPlanPage
                resumeText={resumeText}
                market={market}
                t={t}
                onUploadResume={openResumeUpload}
                onOpenTool={openWorkspaceTool}
                onViewChange={setDashboardView}
              />
            </div>
        )}

        {dashboardView === 'portfolio' && (
            <div id="portfolio-panel">
                 {!resumeText ? (
                    <EmptyState
                        title={t('ws_portfolio_empty_title')}
                        description={t('ws_portfolio_empty_desc')}
                        action={{ label: t('ws_upload_resume'), onClick: () => { setDashboardView('resume'); setIsUpdatingResume(true); } }}
                    />
                 ) : (
                    <AnalysisDisplay
                        t={t}
                        result={null}
                        onReset={handleReset}
                        resumeText={resumeText}
                        userPlan={userPlan}
                        market={market}
                        navigateToPricing={navigateToPricing}
                        session={session}
                        profile={profile}
                        refreshProfile={getProfile}
                        onApplyImprovements={handleApplyImprovements}
                        activeTool="website-builder"
                        setActiveTool={(tool) => setActiveTool(tool)}
                    />
                 )}
            </div>
        )}

        {dashboardView === 'billing' && profile && (
            <div id="billing-panel">
              <CandidateBillingPage
                profile={profile}
                credits={credits}
                t={t}
                onSelectPlan={handleCandidatePlanSelection}
                savingPlan={candidatePlanSaving}
                onViewPricing={navigateToPricing}
              />
            </div>
        )}

        {dashboardView === 'credentials' && session && web3Enabled && (
            <div id="credentials-panel" className="space-y-10 animate-slide-in-up">
                {/* Identity & Wallet shows verification only. Account settings live in their
                    own view — rendering Account here too duplicated the whole panel (QA C13). */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl overflow-hidden border border-gray-100 dark:border-slate-800 shadow-sm">
                    <VerifiedTalentSection t={t} />
                </div>
            </div>
        )}

        {dashboardView === 'account' && session && (
            <div id="account-panel">
                <Account key={session.user.id} session={session} onSetView={handleSetView} onSubscriptionChange={getProfile} navigateToPricing={navigateToPricing} t={t} />
            </div>
        )}
    </div>
  );

  const renderEmployerShell = () => {
    if (!session || !profile || !isEmployer) return null;

    return (
      <React.Suspense fallback={<LoadingSpinner market={market} />}>
        <EmployerPortal
          session={session}
          profile={profile}
          refreshProfile={getProfile}
          navigateToBusinessPricing={navigateToBusinessPricing}
          onGoHome={() => handleSetView('business')}
          onSignOut={() => data.auth.signOut()}
          t={t}
          initialPage={portalInitialPage}
          theme={theme}
          onToggleTheme={toggleTheme}
          currentLang={currentLang}
          onLanguageChange={changeLanguage}
        />
      </React.Suspense>
    );
  };

  const renderRoleFallback = () => (
    <div className="max-w-xl mx-auto my-16 rounded-[var(--site-radius)] border border-[var(--site-border)] bg-[var(--site-surface)] p-6 text-center">
      <h2 className="text-xl font-semibold text-[var(--site-text)]">We could not open the right workspace</h2>
      <p className="mt-2 text-sm text-[var(--site-text-muted)]">
        Your account role is missing or unsupported. Please sign out and sign in again, or contact support if this continues.
      </p>
      <div className="mt-5 flex flex-col sm:flex-row justify-center gap-3">
        <button
          type="button"
          onClick={() => data.auth.signOut()}
          className="rounded-[var(--site-radius)] bg-[var(--site-action)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--site-action-hover)]"
        >
          Sign out
        </button>
        <button
          type="button"
          onClick={() => navigate('/')}
          className="rounded-[var(--site-radius)] border border-[var(--site-border)] px-4 py-2 text-sm font-semibold text-[var(--site-text)] hover:bg-[var(--site-surface-muted)]"
        >
          Back to home
        </button>
      </div>
    </div>
  );

  const renderCandidateShell = () => {
    if (!session || !profile || !isCandidate) return renderRoleFallback();

    // Guided setup takes over the whole screen for fresh sign-ups; the normal
    // shell mounts when it finishes (or is skipped) and offers the tour once.
    if (onboardingActive) {
      return (
        <OnboardingFlow
          uid={session.user.id}
          profile={profile}
          t={t}
          onComplete={({ skipped, resumeText: importedResume }) => {
            if (importedResume) {
              // The workspace's debounced auto-save persists this to the profile.
              setResumeText(importedResume);
              setIsUpdatingResume(false);
            }
            setOnboardingActive(false);
            getProfile();
            if (!skipped && !isTourDone(session.user.id)) setShowTour(true);
          }}
        />
      );
    }

    const sidebarProps = {
      activeView: dashboardView,
      onViewChange: (v: DashboardView) => {
        setDashboardView(v);
        setIsUpdatingResume(false);
        setIsMobileNavOpen(false);
        // Sidebar navigation must take over the main panel immediately. A lingering
        // analysisResult would otherwise keep the analysis screen mounted (renderContent
        // short-circuits on it), making the sidebar feel inactive after an analysis.
        setAnalysisResult(null);
      },
      profile,
      credits,
      theme,
      onToggleTheme: toggleTheme,
      activeTool,
      onToolSelect: (tool: string | null) => {
        setActiveTool(tool);
        setIsMobileNavOpen(false);
      },
      onLogout: () => data.auth.signOut(),
      t,
      currentLang,
      onLanguageChange: changeLanguage,
      onHome: () => { setIsMobileNavOpen(false); navigate('/'); },
    };

    return (
      <>
        <Sidebar {...sidebarProps} />
        {/* Mobile navigation drawer — the sidebar is hidden below lg */}
        {isMobileNavOpen && (
          <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label={t('portal_open_navigation')}>
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
              onClick={() => setIsMobileNavOpen(false)}
              aria-hidden="true"
            />
            <div className="absolute inset-y-0 left-0 animate-slide-in-left">
              <Sidebar {...sidebarProps} mobile />
            </div>
          </div>
        )}
        <div className="flex-1 flex flex-col h-screen overflow-hidden">
          <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 sm:px-8 shrink-0">
            <button
              type="button"
              onClick={() => setIsMobileNavOpen(true)}
              className="lg:hidden p-2 -ml-2 mr-2 text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg"
              aria-label={t('portal_open_navigation')}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <ApiStatusBanner />
            <div className="flex items-center gap-3 ml-auto" data-tour="account-menu">
              <span className="text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-slate-500 hidden sm:block">
                {t(DASHBOARD_VIEW_LABEL_KEYS[dashboardView])}
              </span>
              <AccountMenu
                profile={profile}
                email={session.user.email ?? ''}
                theme={theme}
                onToggleTheme={toggleTheme}
                onAccount={() => setDashboardView('account' as typeof dashboardView)}
                onSignOut={() => data.auth.signOut()}
                t={t}
              />
            </div>
          </header>
          <main className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950 p-6 md:p-10">
            <div className="max-w-6xl mx-auto" data-tour="main">
              {isUpdatingResume && (dashboardView === 'dashboard' || dashboardView === 'resume') ? (
                <div className="mt-4 animate-slide-in-up">
                  <div className="text-center mb-10">
                    <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">{t('dashboard_resume_lab_title')}</h2>
                    <p className="text-gray-600 dark:text-gray-400">{resumeText ? t('dashboard_update_prompt') : t('dashboard_new_user_prompt')}</p>
                  </div>
                  <div id="upload-section" ref={uploadSectionRef} className="scroll-mt-20">
                    <UploadSection t={t} resumeText={resumeText} setResumeText={setResumeText} resumeImages={resumeImages} setResumeImages={setResumeImages} onInitiateAnalysis={handleInitiateAnalysis} isLoading={isLoading} error={error} setError={setError} market={market} setMarket={setMarket} variant={uploadVariant} />
                  </div>
                  {resumeText && (<div className="text-center mt-6"><button onClick={() => setIsUpdatingResume(false)} className="text-sm text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100 font-semibold bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 px-6 py-2 rounded-lg transition-colors">{t('dashboard_cancel_update')}</button></div>)}
                </div>
              ) : renderContent()}
            </div>
          </main>
        </div>

        {/* One-time workspace tour, offered right after the guided setup. */}
        {showTour && (
          <WorkspaceTour
            t={t}
            onClose={() => {
              setShowTour(false);
              markTourDone(session.user.id);
            }}
          />
        )}
      </>
    );
  };

  const renderContent = () => {
    if (view === 'auth') { return <Auth t={t} onClose={() => setView('home')} initialView={initialAuthView} mode={authMode} />; }
    if (view === 'account' && session) { return <Account key={session.user.id} session={session} onSetView={handleSetView} onSubscriptionChange={getProfile} navigateToPricing={navigateToPricing} t={t} />; }
    if (view === 'api_docs') { return <ApiDocsViewer onClose={() => setView('account')} />; }
    if (view === 'business') {
        return (
            <React.Suspense fallback={<LoadingSpinner market={market} />}>
                <BusinessPage t={t} session={session} profile={profile} onSelectBusinessPlan={handleBusinessPlanSelection} onBack={() => handleSetView('home')} onEnterPortal={(page) => { setPortalInitialPage(page); handleSetView('home'); }} refreshProfile={getProfile} authHydrated={authHydrated} />
            </React.Suspense>
        );
    }
    if (view === 'agency' && session && profile) {
        return (
            <React.Suspense fallback={<LoadingSpinner market={market} />}>
                <AgencyHub session={session} profile={profile} t={t} />
            </React.Suspense>
        );
    }
    if (isLoading) {
      return (
        <StagedLoader
          icon={<BarChart3 />}
          accent="blue"
          title={t('analysis_loader_title')}
          steps={[
            t('analysis_loader_step_submit'),
            t('analysis_loader_step_reading'),
            t('analysis_loader_step_market').replace('{market}', market),
            t('analysis_loader_step_scoring'),
          ]}
          intervalMs={2200}
        />
      );
    }
    if (analysisResult) { return <AnalysisDisplay t={t} result={analysisResult} onReset={handleReset} resumeText={resumeText} userPlan={userPlan} market={market} navigateToPricing={navigateToPricing} session={session} profile={profile} refreshProfile={getProfile} onApplyImprovements={handleApplyImprovements} activeTool={activeTool} setActiveTool={setActiveTool} onContinueToToolkit={() => { setAnalysisResult(null); setActiveTool(null); setDashboardView('toolkit'); }} />; }
    if (session && !showHomePageOverride) {
        if (!isProfileLoaded || !isLangLoaded) { return <div className="flex flex-col items-center justify-center space-y-4 my-24"><div className="w-16 h-16 border-4 border-blue-200 border-t-blue-700 rounded-full animate-spin"></div><p className="text-lg text-gray-600 dark:text-gray-400">{t('dashboard_loading')}</p></div>; }
        if (profile?.role === 'agency') {
            return (
                <React.Suspense fallback={<LoadingSpinner market={market} />}>
                    <AgencyHub session={session} profile={profile} t={t} />
                </React.Suspense>
            );
        }
        if (!isCandidate) return renderRoleFallback();
        return renderDashboard();
    }
    if (!isLangLoaded) { return <div className="flex flex-col items-center justify-center space-y-4 my-24"><div className="w-16 h-16 border-4 border-blue-200 border-t-blue-700 rounded-full animate-spin"></div><p className="text-lg text-gray-600">{t('app_loading')}</p></div>; }
    return renderAppEntry();
  };

  const isWorkspaceSessionLoading = Boolean(session && (!isProfileLoaded || !isLangLoaded));
  const canShowWorkspaceShell = Boolean(session && !showHomePageOverride && view !== 'business' && isProfileLoaded && isLangLoaded);
  const showCandidateShell = canShowWorkspaceShell && isCandidate && !isPortalEntry;
  const showEmployerShell = canShowWorkspaceShell && isEmployer;
  const showUnsupportedRole = canShowWorkspaceShell && !isKnownWorkspaceRole;

  const rootClass = `beta-root min-h-screen w-full ${showCandidateShell || showEmployerShell ? 'flex' : 'block'}`;

  return (
      <div className={rootClass}>
        {isRedirecting && <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[999] p-4 animate-fade-in"><div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl p-8 text-center flex flex-col items-center"><h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">Finalizing Your Upgrade!</h3><p className="mt-2 text-gray-600 dark:text-gray-300">To activate your new plan, we're opening our secure payment page.</p><div className="mt-6 w-12 h-12 border-4 border-blue-200 border-t-blue-700 rounded-full animate-spin"></div></div></div>}
        <CreditModal isOpen={isCreditModalOpen} onClose={() => setIsCreditModalOpen(false)} onConfirm={() => { setIsCreditModalOpen(false); performAnalysis(); }} onNavigateToPricing={navigateToPricing} cost={analysisCost} currentCredits={credits} />
        
        {isWorkspaceSessionLoading ? (
            <div className="flex min-h-screen w-full items-center justify-center">
              <LoadingSpinner market={market} />
            </div>
        ) : showEmployerShell ? (
            renderEmployerShell()
        ) : showCandidateShell ? (
            renderCandidateShell()
        ) : showUnsupportedRole ? (
            renderRoleFallback()
        ) : (
            <SiteLayout pageId={isPortalEntry ? 'portal' : 'workspace'} marketingShell={false}>
              {renderWorkspaceBody()}
            </SiteLayout>
        )}

        <CookieConsent t={t} />

        {!isChatOpen && (
          <button
            onClick={() => setIsChatOpen(true)}
            className="fixed right-4 top-[calc(4.75rem+env(safe-area-inset-top))] bottom-auto z-40 flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-lg transition-all duration-300 hover:scale-105 hover:shadow-xl sm:top-auto sm:bottom-6 sm:right-6 sm:h-16 sm:w-16"
            aria-label={t('coach_open_label')}
            aria-expanded={isChatOpen}
          >
            <svg className="h-6 w-6 sm:h-8 sm:w-8" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M16.82 7.18002C16.82 5.58002 15.42 4.18002 13.82 4.18002C12.22 4.18002 10.82 5.58002 10.82 7.18002C10.82 8.78002 12.22 10.18 13.82 10.18C15.42 10.18 16.82 8.78002 16.82 7.18002Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M12 14.63H15.63" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M19.13 9.32002C20.94 11.52 20.73 14.6 18.6 16.59C16.47 18.58 13.06 18.74 11.02 16.94L7.52002 20.44C7.14002 20.82 6.51002 20.82 6.13002 20.44L4.21002 18.52C3.83002 18.14 3.83002 17.51 4.21002 17.13L7.71002 13.63C5.91002 11.59 5.75002 8.43002 7.74002 6.30002" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
        )}
        {isChatOpen && <CareerCoachBot isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} session={session} profile={profile} resumeText={resumeText} t={t} />}
      </div>
  );
};

interface AppWrapperProps {
  entry?: 'workspace' | 'portal';
}

// Api/Credits/Settings providers come from SiteApp (the only mount point), so the
// workspace shares one state instance with the marketing shell instead of shadowing it.
const AppWrapper: React.FC<AppWrapperProps> = ({ entry }) => (
    <ToastProvider>
        <AppContent entry={entry} />
    </ToastProvider>
);

export default AppWrapper;
