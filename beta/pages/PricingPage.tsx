import React, { useState } from 'react';
import { BetaLayout } from '../components/BetaLayout';
import { BetaButton } from '../components/BetaButton';
import { BetaCard } from '../components/BetaCard';
import { BETA_ROUTES } from '../../config/beta';

const jobseekerPlans = [
  {
    name: 'Free',
    price: '$0',
    desc: 'Try the report',
    features: ['1 report / month', 'Basic ATS check', 'Keyword gap list'],
    recommended: false,
  },
  {
    name: 'Career Essentials',
    price: '$19',
    desc: 'Active search',
    features: ['Resume + cover letter tools', 'Role Match', 'Unlimited keyword reports'],
    recommended: true,
  },
  {
    name: 'Career Accelerator',
    price: '$49',
    desc: 'Interview-ready',
    features: ['Interview Practice', 'Career Path Planner', 'Unlimited reports'],
    recommended: false,
  },
  {
    name: 'Executive',
    price: '$99',
    desc: 'Senior moves',
    features: ['Salary negotiation', 'Advanced coaching', 'Priority support'],
    recommended: false,
  },
];

const employerPlans = [
  {
    name: 'Single Post',
    price: '$49',
    desc: 'One role',
    features: ['1 active post', '30-day listing', 'Match explanations'],
    recommended: false,
  },
  {
    name: 'Hiring Starter',
    price: '$79',
    desc: 'Small team',
    features: ['8 active posts', 'Candidate unlocks', 'Basic analytics'],
    recommended: true,
  },
  {
    name: 'Growth',
    price: '$199',
    desc: 'Scaling hiring',
    features: ['20 active posts', 'Advanced matching', 'Company profile'],
    recommended: false,
  },
  {
    name: 'Team / Enterprise',
    price: 'Custom',
    desc: 'High volume',
    features: ['Unlimited posts', 'Dedicated support', 'API access'],
    recommended: false,
  },
];

export const PricingPage: React.FC = () => {
  const [audience, setAudience] = useState<'jobseeker' | 'employer'>('jobseeker');
  const plans = audience === 'jobseeker' ? jobseekerPlans : employerPlans;

  return (
    <BetaLayout>
      <section className="py-[var(--beta-section)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <h1 className="text-3xl font-semibold text-center mb-4">Pricing</h1>
          <p className="text-center text-[var(--beta-text-muted)] mb-8 max-w-xl mx-auto">
            {audience === 'jobseeker'
              ? 'Plans by how deeply you use career tools — not by AI feature count.'
              : 'Plans by hiring volume — match explanations and active posts, not tool lists.'}
          </p>
          <div className="flex justify-center gap-2 mb-12">
            <button
              type="button"
              onClick={() => setAudience('jobseeker')}
              className={`px-4 py-2 rounded-[var(--beta-radius)] text-sm font-medium ${
                audience === 'jobseeker'
                  ? 'bg-[var(--beta-action)] text-white'
                  : 'border border-[var(--beta-border)] text-[var(--beta-text-muted)]'
              }`}
            >
              Job seekers
            </button>
            <button
              type="button"
              onClick={() => setAudience('employer')}
              className={`px-4 py-2 rounded-[var(--beta-radius)] text-sm font-medium ${
                audience === 'employer'
                  ? 'bg-[var(--beta-action)] text-white'
                  : 'border border-[var(--beta-border)] text-[var(--beta-text-muted)]'
              }`}
            >
              Employers
            </button>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 items-stretch">
            {plans.map((plan) => (
              <BetaCard
                key={plan.name}
                className={`flex flex-col ${
                  plan.recommended ? 'border-2 border-[var(--beta-action)] lg:-mt-2 lg:mb-2' : ''
                }`}
              >
                {plan.recommended && (
                  <p className="text-xs font-medium text-[var(--beta-action)] mb-2">Recommended</p>
                )}
                <h3 className="font-semibold text-lg">{plan.name}</h3>
                <p className="text-2xl font-semibold mt-2">
                  {plan.price}
                  {plan.price !== 'Custom' && <span className="text-sm font-normal text-[var(--beta-text-muted)]">/mo</span>}
                </p>
                <p className="text-sm text-[var(--beta-text-muted)] mt-1 mb-4">{plan.desc}</p>
                <ul className="text-sm space-y-2 flex-1 text-[var(--beta-text-muted)]">
                  {plan.features.map((f) => (
                    <li key={f}>· {f}</li>
                  ))}
                </ul>
                <BetaButton
                  variant={plan.recommended ? 'primary' : 'secondary'}
                  href={BETA_ROUTES.mvpApp}
                  className="mt-6 w-full"
                >
                  Get started
                </BetaButton>
              </BetaCard>
            ))}
          </div>
        </div>
      </section>
    </BetaLayout>
  );
};
