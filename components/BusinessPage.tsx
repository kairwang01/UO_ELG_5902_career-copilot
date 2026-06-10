
import React, { useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { AppSession as Session } from '../lib/data';
import type { UserProfile } from '../types';
import BusinessSignInModal from './business/BusinessSignInModal';
import BusinessSignUpModal from './business/BusinessSignUpModal';
import BusinessForgotPasswordModal from './business/BusinessForgotPasswordModal';
import type { PortalPage } from './employer/EmployerPortal';

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

// Business plans matching the prototype design — static ids/prices/periods only;
// names and features are resolved via t() inside the component.
const businessPlanDefs = [
  {
    id: 'free',
    nameKey: 'business_page_plan_free_name',
    price: '$0',
    period: '/ month',
    highlight: null,
    featured: false,
    featureKeys: [
      'business_page_plan_free_feature_1',
      'business_page_plan_free_feature_2',
      'business_page_plan_free_feature_3',
      'business_page_plan_free_feature_4',
    ],
  },
  {
    id: 'starter',
    nameKey: 'site_plan_emp_starter_name',
    price: '$79',
    period: '/ month',
    highlight: 'popular',
    featured: true,
    featureKeys: [
      'business_page_plan_starter_feature_1',
      'business_page_plan_starter_feature_2',
      'business_page_plan_starter_feature_3',
      'site_plan_emp_starter_f4',
    ],
  },
  {
    id: 'growth',
    nameKey: 'site_plan_emp_growth_name',
    price: '$199',
    period: '/ month',
    highlight: null,
    featured: false,
    featureKeys: [
      'business_page_plan_growth_feature_1',
      'business_page_plan_growth_feature_2',
      'business_page_plan_growth_feature_3',
      'site_plan_emp_growth_f4',
    ],
  },
  {
    id: 'pro',
    nameKey: 'business_page_plan_pro_name',
    price: '$499',
    period: '/ month',
    highlight: null,
    featured: false,
    featureKeys: [
      'business_page_plan_pro_feature_1',
      'business_page_plan_pro_feature_2',
      'business_page_plan_pro_feature_3',
      'site_plan_emp_team_f4',
    ],
  },
];

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

  const handlePostJob = () => {
    if (session && onEnterPortal) {
      onEnterPortal('post-job');
    } else if (session) {
      onBack();
    } else {
      setModal('signup');
    }
  };

  const handleDiscoverTalent = () => {
    if (session && onEnterPortal) {
      onEnterPortal('talent-pool');
    } else if (session) {
      onBack();
    } else {
      setModal('signup');
    }
  };

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
      <main className="max-w-[1088px] mx-auto px-6 py-16 md:py-24">
        <h1 className="text-3xl sm:text-4xl md:text-6xl font-bold leading-tight mb-6 text-gray-900 dark:text-gray-100 break-words">
          {t('business_page_hero_title_part1')}{' '}
          <span className="text-[#1D4ED8]">{t('business_page_hero_title_part2')}</span>{t('business_page_hero_title_part3')}
        </h1>
        <p className="text-lg mb-8 leading-relaxed max-w-3xl text-gray-600 dark:text-gray-300">
          {t('business_page_hero_subtitle')}
        </p>
        <div className="flex flex-wrap gap-4">
          <button
            onClick={handlePostJob}
            className="w-full sm:w-auto bg-[#1D4ED8] text-white px-8 py-3 rounded-md hover:bg-[#1e40af] transition-colors font-medium"
          >
            {t('employer_dashboard_post_job_button')}
          </button>
          <button
            onClick={handleDiscoverTalent}
            className="w-full sm:w-auto border border-gray-300 text-gray-700 px-8 py-3 rounded-md hover:border-gray-400 transition-colors font-medium dark:border-slate-600 dark:text-gray-300 dark:hover:border-slate-500"
          >
            {t('employer_dashboard_tab_discover')}
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

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                titleKey: 'business_page_feature_ai_title',
                descKey: 'business_page_feature_ai_desc',
                icon: (
                  <svg className="w-6 h-6 text-[#1D4ED8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                ),
              },
              {
                titleKey: 'business_page_feature_engaged_title',
                descKey: 'business_page_feature_engaged_desc',
                icon: (
                  <svg className="w-6 h-6 text-[#1D4ED8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                ),
              },
              {
                titleKey: 'business_page_feature_simple_title',
                descKey: 'business_page_feature_simple_desc',
                icon: (
                  <svg className="w-6 h-6 text-[#1D4ED8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                ),
              },
              {
                titleKey: 'business_page_feature_diverse_title',
                descKey: 'business_page_feature_diverse_desc',
                icon: (
                  <svg className="w-6 h-6 text-[#1D4ED8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ),
              },
            ].map((feature) => (
              <div key={feature.titleKey} className="rounded-xl p-6 shadow-sm bg-white dark:bg-slate-800 dark:border dark:border-slate-700">
                <div className="w-12 h-12 rounded-md flex items-center justify-center mb-4 bg-blue-100 dark:bg-blue-900/40">
                  {feature.icon}
                </div>
                <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-gray-100">{t(feature.titleKey)}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">{t(feature.descKey)}</p>
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
                    {plan.price}
                  </span>
                  <span className={`mb-1 ${plan.featured ? 'text-gray-400' : 'text-gray-500 dark:text-gray-400'}`}>
                    {plan.period}
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
                  onClick={() => {
                    if (session) {
                      onSelectBusinessPlan(plan.id);
                    } else {
                      setModal('signup');
                    }
                  }}
                  className={`w-full py-2.5 rounded-lg font-medium transition-colors ${
                    plan.featured
                      ? 'bg-[#1D4ED8] text-white hover:bg-[#1e40af]'
                      : 'border border-[#1D4ED8] text-[#1D4ED8] hover:bg-[#1D4ED8] hover:text-white'
                  }`}
                >
                  {t('business_hero_get_started_button')}
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
      />
      <BusinessSignUpModal
        isOpen={modal === 'signup'}
        onOpenChange={(open) => setModal(open ? 'signup' : 'none')}
        onSwitchToSignIn={() => setModal('signin')}
        onSignedUp={refreshProfile}
        t={t}
      />
      <BusinessForgotPasswordModal
        isOpen={modal === 'forgot'}
        onOpenChange={(open) => setModal(open ? 'forgot' : 'none')}
        onSwitchToSignIn={() => setModal('signin')}
      />
    </div>
  );
};

export default BusinessPage;
