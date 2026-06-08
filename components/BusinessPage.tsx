
import React, { useRef } from 'react';
import type { AppSession as Session } from '../lib/data';
import type { UserProfile } from '../types';
import BusinessSignInModal from './business/BusinessSignInModal';
import BusinessSignUpModal from './business/BusinessSignUpModal';
import BusinessForgotPasswordModal from './business/BusinessForgotPasswordModal';
import { data } from '@/lib/data';
import type { PortalPage } from './employer/EmployerPortal';

interface BusinessPageProps {
  onPostJobClick: () => void;
  onSignInClick: () => void;
  session: Session | null;
  profile: UserProfile | null;
  onSelectBusinessPlan: (planKey: string) => void;
  t: (key: string) => string;
  onBack: () => void;
  // Optional: enter the hiring portal at a specific page
  onEnterPortal?: (page: PortalPage) => void;
  refreshProfile?: () => Promise<void>;
}

// Business plans matching the prototype design
const businessPlans = [
  {
    id: 'free',
    name: 'Free Plan',
    price: '$0',
    period: '/ month',
    highlight: null,
    featured: false,
    features: [
      '3 active job posts',
      '30-day job listing',
      'Basic AI job creation',
      'Standard applicant view',
    ],
  },
  {
    id: 'starter',
    name: 'Starter',
    price: '$79',
    period: '/ month',
    highlight: 'MOST POPULAR',
    featured: true,
    features: [
      '8 active job posts',
      '30-day job visibility',
      'AI job description generator',
      'Basic candidate matching',
    ],
  },
  {
    id: 'growth',
    name: 'Growth',
    price: '$199',
    period: '/ month',
    highlight: null,
    featured: false,
    features: [
      '20 active job posts',
      '45-day job visibility',
      'Advanced AI matching',
      'Analytics & company branding',
    ],
  },
  {
    id: 'pro',
    name: 'Pro / Enterprise',
    price: '$499',
    period: '/ month',
    highlight: null,
    featured: false,
    features: [
      '100 active job posts',
      '60-day premium visibility',
      'Full AI + verified talent access',
      'Priority support & insights',
    ],
  },
];

type ModalState = 'none' | 'signin' | 'signup' | 'forgot';

const BusinessPage: React.FC<BusinessPageProps> = ({
  onPostJobClick,
  onSignInClick,
  session,
  profile,
  onSelectBusinessPlan,
  t,
  onBack,
  onEnterPortal,
  refreshProfile,
}) => {
  const pricingRef = useRef<HTMLElement>(null);
  const [modal, setModal] = React.useState<ModalState>('none');

  const scrollToPricing = (e: React.MouseEvent) => {
    e.preventDefault();
    pricingRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

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

  const handleHiringPortal = () => {
    if (session && onEnterPortal) {
      onEnterPortal('dashboard');
    } else if (session) {
      onBack();
    } else {
      setModal('signin');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Nav */}
      <nav className="bg-blue-950 border-b border-blue-900">
        <div className="max-w-[1088px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Logo — scroll to top; this IS the business homepage */}
            <button
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="flex items-center gap-2 focus:outline-none"
              aria-label="Career CoPilot home"
            >
              <div className="w-8 h-8 bg-blue-400 rounded-md flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <span className="font-semibold text-xl text-white">Career CoPilot</span>
            </button>

            {/* Nav links */}
            <div className="hidden md:flex items-center gap-8">
              <button
                onClick={handleHiringPortal}
                className="text-gray-200 hover:text-white transition-colors"
              >
                Hiring Portal
              </button>
              <button
                onClick={handlePostJob}
                className="text-gray-200 hover:text-white transition-colors"
              >
                Post a Job
              </button>
              <a
                href="#pricing"
                onClick={scrollToPricing}
                className="text-gray-200 hover:text-white transition-colors"
              >
                Pricing
              </a>
            </div>

            {/* Auth buttons */}
            <div className="flex items-center gap-4">
              {session ? (
                <>
                  <span className="text-gray-300 text-sm">
                    {profile?.full_name || session.user.email}
                  </span>
                  <button
                    onClick={() => data.auth.signOut()}
                    className="text-gray-200 hover:text-white transition-colors text-sm"
                  >
                    Sign Out
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => setModal('signin')}
                    className="text-gray-200 hover:text-white transition-colors"
                  >
                    Sign In
                  </button>
                  <button
                    onClick={() => setModal('signup')}
                    className="bg-[#1D4ED8] text-white px-6 py-2 rounded-md hover:bg-[#1e40af] transition-colors"
                  >
                    Get Started
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <main className="max-w-[1088px] mx-auto px-6 py-16 md:py-24">
        <h1 className="text-5xl md:text-6xl font-bold leading-tight mb-6 text-gray-900">
          Connect with{' '}
          <span className="text-[#1D4ED8]">Top Talent</span>, Faster.
        </h1>
        <p className="text-lg mb-8 leading-relaxed max-w-3xl text-gray-600">
          Post your job on Career CoPilot and reach a curated pool of ambitious
          professionals actively improving their careers with our AI tools.
        </p>
        <div className="flex flex-wrap gap-4">
          <button
            onClick={handlePostJob}
            className="bg-[#1D4ED8] text-white px-8 py-3 rounded-md hover:bg-[#1e40af] transition-colors font-medium"
          >
            Post a Job
          </button>
          <button
            onClick={handleDiscoverTalent}
            className="border border-gray-300 text-gray-700 px-8 py-3 rounded-md hover:border-gray-400 transition-colors font-medium"
          >
            Discover Talent
          </button>
        </div>
      </main>

      {/* Features — "Why Post With Us?" */}
      <section className="py-16">
        <div className="max-w-[1088px] mx-auto px-6">
          <h2 className="text-center text-3xl font-bold mb-4 text-gray-900">
            Why Post With Us?
          </h2>
          <p className="text-center mb-12 max-w-2xl mx-auto text-gray-600">
            Access a unique pool of candidates who are serious about their professional growth
          </p>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                title: 'AI-Matched Candidates',
                desc: 'Our platform analyzes candidate resumes against your job description, highlighting top matches and saving you time.',
                icon: (
                  <svg className="w-6 h-6 text-[#1D4ED8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                ),
              },
              {
                title: 'Engaged Talent Pool',
                desc: 'Reach candidates who are proactively working on their career development, not just passively browsing.',
                icon: (
                  <svg className="w-6 h-6 text-[#1D4ED8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                ),
              },
              {
                title: 'Simplified Posting',
                desc: 'A straightforward job posting process gets your role in front of the right people in minutes.',
                icon: (
                  <svg className="w-6 h-6 text-[#1D4ED8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                ),
              },
              {
                title: 'Diverse Reach',
                desc: 'Connect with a global community, including recent graduates, career switchers, and new immigrants.',
                icon: (
                  <svg className="w-6 h-6 text-[#1D4ED8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ),
              },
            ].map((feature) => (
              <div key={feature.title} className="rounded-xl p-6 shadow-sm bg-white">
                <div className="w-12 h-12 rounded-md flex items-center justify-center mb-4 bg-blue-100">
                  {feature.icon}
                </div>
                <h3 className="text-lg font-semibold mb-2 text-gray-900">{feature.title}</h3>
                <p className="text-sm text-gray-600">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section
        id="pricing"
        ref={pricingRef}
        className="py-20 bg-gray-50"
      >
        <div className="max-w-[1088px] mx-auto px-6">
          <h2 className="text-center text-4xl font-bold mb-4 text-gray-900">
            Simple &amp; Transparent Pricing
          </h2>
          <p className="text-center mb-14 max-w-2xl mx-auto text-gray-500">
            Choose a plan that fits your hiring needs. No hidden fees.
          </p>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">
            {businessPlans.map((plan) => (
              <div
                key={plan.id}
                className={`relative rounded-2xl p-7 flex flex-col ${
                  plan.featured
                    ? 'bg-[#0F172A] text-white shadow-2xl ring-2 ring-[#1D4ED8]'
                    : 'bg-white text-gray-900 shadow-sm'
                }`}
              >
                {plan.highlight && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <span className="bg-[#1D4ED8] text-white text-xs font-bold px-4 py-1.5 rounded-full uppercase tracking-wide whitespace-nowrap">
                      Most Popular
                    </span>
                  </div>
                )}

                <p className={`font-semibold mb-3 ${plan.featured ? 'text-gray-300' : 'text-gray-700'}`}>
                  {plan.name}
                </p>

                <div className="flex items-end gap-1 mb-1">
                  <span className={`text-5xl font-bold leading-none ${plan.featured ? 'text-white' : 'text-gray-900'}`}>
                    {plan.price}
                  </span>
                  <span className={`mb-1 ${plan.featured ? 'text-gray-400' : 'text-gray-500'}`}>
                    {plan.period}
                  </span>
                </div>

                <div className={`h-px my-5 ${plan.featured ? 'bg-gray-700' : 'bg-gray-100'}`} />

                <ul className="flex flex-col gap-3 flex-1 mb-8">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5">
                      <svg
                        className={`w-5 h-5 mt-0.5 flex-shrink-0 ${plan.featured ? 'text-[#60A5FA]' : 'text-[#1D4ED8]'}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className={`text-sm ${plan.featured ? 'text-gray-300' : 'text-gray-600'}`}>
                        {feature}
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
                  Get Started
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
