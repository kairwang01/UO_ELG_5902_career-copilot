
import React, { useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { AppSession as Session } from '../lib/data';
import type { UserProfile } from '../types';
import BusinessSignInModal from './business/BusinessSignInModal';
import BusinessSignUpModal from './business/BusinessSignUpModal';
import BusinessForgotPasswordModal from './business/BusinessForgotPasswordModal';
import type { PortalPage } from './employer/EmployerPortal';
import { businessPlanDefs, type BusinessPlanId } from './business/businessPlans';
import { CheckCircle2, Globe2, PlusCircle, Users } from 'lucide-react';

interface BusinessPageProps {
  session: Session | null;
  profile: UserProfile | null;
  onSelectBusinessPlan: (planKey: string) => void;
  t: (key: string) => string;
  onBack: () => void;
  // Optional: enter the hiring portal at a specific page
  onEnterPortal?: (page: PortalPage) => void;
  refreshProfile?: () => Promise<void>;
  // When true, Firebase has restored the persisted session (or confirmed no session).
  // When false, the session is still being restored — auth-modal params must wait.
  // When undefined (prop not wired), hydration guard is skipped (legacy behaviour).
  authHydrated?: boolean;
}

type ModalState = 'none' | 'signin' | 'signup' | 'forgot';

const BusinessPage: React.FC<BusinessPageProps> = ({
  session,
  profile,
  onSelectBusinessPlan,
  t,
  onBack,
  onEnterPortal,
  refreshProfile,
  authHydrated,
}) => {
  const pricingRef = useRef<HTMLElement>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const [modal, setModal] = React.useState<ModalState>('none');
  const [signupPlan, setSignupPlan] = React.useState<BusinessPlanId>('starter');

  const handlePostJob = () => {
    if (session && onEnterPortal) {
      onEnterPortal('post-job');
    } else if (session) {
      onBack();
    } else {
      setSignupPlan('starter');
      setModal('signup');
    }
  };

  const handleDiscoverTalent = () => {
    if (session && onEnterPortal) {
      onEnterPortal('talent-pool');
    } else if (session) {
      onBack();
    } else {
      setSignupPlan('starter');
      setModal('signup');
    }
  };

  const handleViewPricing = () => {
    pricingRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const featureCards = [
    {
      titleKey: 'business_page_feature_ai_title',
      descKey: 'business_page_feature_ai_desc',
      Icon: CheckCircle2,
    },
    {
      titleKey: 'business_page_feature_engaged_title',
      descKey: 'business_page_feature_engaged_desc',
      Icon: Users,
    },
    {
      titleKey: 'business_page_feature_simple_title',
      descKey: 'business_page_feature_simple_desc',
      Icon: PlusCircle,
    },
    {
      titleKey: 'business_page_feature_diverse_title',
      descKey: 'business_page_feature_diverse_desc',
      Icon: Globe2,
    },
  ] as const;

  // Honour ?auth=signin|signup and ?start=post-job. Reads react-router's reactive
  // location.search and depends on it, so clicking the header "Sign In" link AGAIN
  // while already mounted on /portal re-opens the modal. (Previously a one-shot ref
  // + non-reactive window.location.search meant the second click did nothing —
  // the same bug we fixed for /workspace?auth=signin in CareerApp.)
  //
  // Hydration guard: if authHydrated is explicitly false (CareerApp has wired the
  // prop but Firebase has not yet restored the persisted session), bail out WITHOUT
  // stripping the query. The effect will re-run once authHydrated flips to true, at
  // which point the session state is accurate and the params are still present.
  // If authHydrated is undefined (prop not wired), the guard is skipped to preserve
  // legacy behaviour for any consumer that does not pass the prop.
  React.useEffect(() => {
    if (authHydrated === false) return;

    const params = new URLSearchParams(location.search);
    const auth = params.get('auth');
    const start = params.get('start');
    if (!auth && !start) return;

    // Only open auth modals when the user is NOT already signed in; a signed-in
    // user deep-linking with ?auth=signin (e.g. from a stale email link) should
    // not be interrupted with a redundant modal.
    if (!session) {
      if (auth === 'signin') setModal('signin');
      if (auth === 'signup') setModal('signup');
    }

    // ?start=post-job is NOT gated on !session — a signed-in employer must still
    // land in the portal. onEnterPortal's own session check handles the redirect.
    if (start === 'post-job') {
      if (session && onEnterPortal) {
        onEnterPortal('post-job');
      } else {
        setModal('signup');
      }
    }

    // Strip the query via react-router so location.search stays in sync; the
    // effect re-runs once more and no-ops (no params).
    navigate(location.pathname, { replace: true });
  }, [location.search, location.pathname, navigate, session, onEnterPortal, authHydrated]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Hero */}
      <main className="mx-auto max-w-[1088px] px-4 py-14 sm:px-6 sm:py-16 md:py-24">
        <h1 className="max-w-5xl break-words text-3xl font-bold leading-tight text-gray-900 dark:text-gray-100 sm:text-4xl md:text-6xl">
          {t('business_page_hero_title_part1')}{' '}
          <span className="text-[#1D4ED8]">{t('business_page_hero_title_part2')}</span>{t('business_page_hero_title_part3')}
        </h1>
        <p className="mt-6 max-w-3xl text-base leading-7 text-gray-600 dark:text-gray-300 sm:text-lg">
          {t('business_page_hero_subtitle')}
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <button
            type="button"
            onClick={handlePostJob}
            className="inline-flex min-h-12 w-full items-center justify-center rounded-lg bg-[#1D4ED8] px-6 py-3 text-center font-semibold text-white shadow-sm transition hover:bg-[#1e40af] focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/40 sm:w-auto"
          >
            {t('employer_dashboard_post_job_button')}
          </button>
          <button
            type="button"
            onClick={handleDiscoverTalent}
            className="inline-flex min-h-12 w-full items-center justify-center rounded-lg border border-gray-300 bg-white px-6 py-3 text-center font-semibold text-gray-700 transition hover:border-gray-400 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/30 dark:border-slate-600 dark:bg-gray-900 dark:text-gray-300 dark:hover:border-slate-500 dark:hover:bg-slate-800 sm:w-auto"
          >
            {t('employer_dashboard_tab_discover')}
          </button>
          <button
            type="button"
            onClick={handleViewPricing}
            className="inline-flex min-h-12 w-full items-center justify-center rounded-lg border border-transparent px-6 py-3 text-center font-semibold text-[#1D4ED8] transition hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/30 dark:text-blue-300 dark:hover:bg-blue-950/30 sm:w-auto"
          >
            {t('business_hero_view_pricing_button')}
          </button>
        </div>
      </main>

      {/* Features — "Why Post With Us?" */}
      <section className="py-16">
        <div className="max-w-[1088px] mx-auto px-6">
          <h2 className="text-center text-3xl font-bold mb-4 text-gray-900 dark:text-gray-100">
            {t('business_page_features_title')}
          </h2>
          <p className="text-center mb-12 max-w-2xl mx-auto text-gray-600 dark:text-gray-300">
            {t('business_page_features_subtitle')}
          </p>

          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {featureCards.map(({ titleKey, descKey, Icon }) => (
              <div key={titleKey} className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-200/80 transition hover:-translate-y-0.5 hover:shadow-md dark:bg-slate-800 dark:ring-slate-700 sm:p-6">
                <div className="w-12 h-12 rounded-md flex items-center justify-center mb-4 bg-blue-100 dark:bg-blue-900/40">
                  <Icon className="h-6 w-6 text-[#1D4ED8]" aria-hidden="true" />
                </div>
                <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-gray-100">{t(titleKey)}</h3>
                <p className="text-sm leading-6 text-gray-600 dark:text-gray-400">{t(descKey)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section
        id="pricing"
        ref={pricingRef}
        className="py-20 bg-gray-50 dark:bg-gray-950"
      >
        <div className="max-w-[1088px] mx-auto px-6">
          <h2 className="text-center text-4xl font-bold mb-4 text-gray-900 dark:text-gray-100">
            {t('business_page_pricing_title')}
          </h2>
          <p className="text-center mb-14 max-w-2xl mx-auto text-gray-500 dark:text-gray-400">
            {t('business_page_pricing_subtitle')}
          </p>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">
            {businessPlanDefs.map((plan) => (
              <div
                key={plan.id}
                className={`relative rounded-2xl p-7 flex flex-col ${
                  plan.featured
                    ? 'bg-[#0F172A] text-white shadow-2xl ring-2 ring-[#1D4ED8]'
                    : 'bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 shadow-sm dark:border dark:border-slate-700'
                }`}
              >
                {plan.highlight && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <span className="bg-[#1D4ED8] text-white text-xs font-bold px-4 py-1.5 rounded-full uppercase tracking-wide whitespace-nowrap">
                      {t('business_page_pricing_badge_popular')}
                    </span>
                  </div>
                )}

                <p className={`font-semibold mb-3 ${plan.featured ? 'text-gray-300' : 'text-gray-700 dark:text-gray-300'}`}>
                  {t(plan.nameKey)}
                </p>

                <div className="flex items-end gap-1 mb-1">
                  <span className={`text-5xl font-bold leading-none ${plan.featured ? 'text-white' : 'text-gray-900 dark:text-gray-100'}`}>
                    ${plan.price}
                  </span>
                  <span className={`mb-1 ${plan.featured ? 'text-gray-400' : 'text-gray-500 dark:text-gray-400'}`}>
                    {t('site_pricing_per_month')}
                  </span>
                </div>

                <div className={`h-px my-5 ${plan.featured ? 'bg-gray-700' : 'bg-gray-100 dark:bg-slate-700'}`} />

                <ul className="flex flex-col gap-3 flex-1 mb-8">
                  {plan.featureKeys.map((featureKey) => (
                    <li key={featureKey} className="flex items-start gap-2.5">
                      <svg
                        className={`w-5 h-5 mt-0.5 flex-shrink-0 ${plan.featured ? 'text-[#60A5FA]' : 'text-[#1D4ED8]'}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className={`text-sm ${plan.featured ? 'text-gray-300' : 'text-gray-600 dark:text-gray-300'}`}>
                        {t(featureKey)}
                      </span>
                    </li>
                  ))}
                </ul>

                <button
                  type="button"
                  onClick={() => {
                    if (session) {
                      onSelectBusinessPlan(plan.id);
                    } else {
                      setSignupPlan(plan.id);
                      setModal('signup');
                    }
                  }}
                  className={`min-h-11 w-full rounded-lg py-2.5 font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/40 ${
                    plan.featured
                      ? 'bg-[#1D4ED8] text-white hover:bg-[#1e40af]'
                      : 'border border-[#1D4ED8] text-[#1D4ED8] hover:bg-[#1D4ED8] hover:text-white dark:hover:text-white'
                  }`}
                >
                  {t('business_page_plan_cta')}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Auth modals — wired to real Firebase auth via lib/data */}
      <BusinessSignInModal
        isOpen={modal === 'signin'}
        onOpenChange={(open) => setModal(open ? 'signin' : 'none')}
        onSwitchToSignUp={() => setModal('signup')}
        onSwitchToForgotPassword={() => setModal('forgot')}
        t={t}
      />
      <BusinessSignUpModal
        isOpen={modal === 'signup'}
        onOpenChange={(open) => setModal(open ? 'signup' : 'none')}
        onSwitchToSignIn={() => setModal('signin')}
        onSignedUp={refreshProfile}
        initialPlan={signupPlan}
        t={t}
      />
      <BusinessForgotPasswordModal
        isOpen={modal === 'forgot'}
        onOpenChange={(open) => setModal(open ? 'forgot' : 'none')}
        onSwitchToSignIn={() => setModal('signin')}
        t={t}
      />
    </div>
  );
};

export default BusinessPage;
