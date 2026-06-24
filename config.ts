
import type { Plan } from './types';

export const DEFAULT_MARKET = 'Canada';

export const SUPPORTED_MARKETS = [
  'Canada',
  'United States',
  'United Kingdom',
  'Germany',
  'France',
  'Japan',
  'China',
  'Vietnam',
  'Singapore',
  'Australia',
];

// NOTE: These are placeholder test links. Replace them with your actual Stripe links.
// In your Stripe dashboard, configure the payment link's success URL to:
// [YOUR_APP_URL]/?payment_success=true&plan={CHECKOUT_SESSION_ID}
// And the cancel URL to:
// [YOUR_APP_URL]/?payment_cancelled=true
export const STRIPE_ESSENTIALS_PLAN_LINK = 'https://buy.stripe.com/test_7sI5m4e7g8A4e685kk';
export const STRIPE_ACCELERATOR_PLAN_LINK = 'https://buy.stripe.com/test_dR66q8cZc1do2yY4gh'; // Placeholder
export const STRIPE_EXECUTIVE_PLAN_LINK = 'https://buy.stripe.com/test_14k16kcZc8A4gacbIJ'; // Placeholder
export const STRIPE_CUSTOMER_PORTAL_LINK = 'https://billing.stripe.com/p/login/test_7sI5m4e7g8A4e685kk';

export const ALL_PLANS: { [key: string]: Plan & { key: string } } = {
  free: {
    key: 'free',
    name: 'Free',
    price: '$0',
    priceDescription: 'per month',
    features: [
      '150 starter credits',
      '30 credits monthly',
      'Access to all AI tools',
      '10 tool runs per day',
    ],
    analysisLimit: 1, // Kept for legacy free analysis check
    creditsPerMonth: 30,
  },
  essentials: {
    key: 'essentials',
    name: 'Basic',
    price: '$19',
    priceDescription: 'CAD per month',
    features: [
      '300 credits included monthly',
      'Access to all AI tools',
      'PDF and Word exports',
      'Unused credits never expire',
    ],
    analysisLimit: Infinity,
    creditsPerMonth: 300,
    stripeLink: STRIPE_ESSENTIALS_PLAN_LINK,
  },
  accelerator: {
    key: 'accelerator',
    name: 'Pro',
    price: '$39',
    priceDescription: 'CAD per month',
    features: [
      '1000 credits included monthly',
      'Best value for an active job search',
      'Access to all AI tools',
      'Unused credits never expire',
    ],
    analysisLimit: Infinity,
    creditsPerMonth: 1000,
    stripeLink: STRIPE_ACCELERATOR_PLAN_LINK,
  },
  executive: {
    key: 'executive',
    name: 'Premium',
    price: '$79',
    priceDescription: 'CAD per month',
    features: [
      '3000 credits included monthly',
      'For intensive search and interview prep',
      'Access to all AI tools',
      'Priority support',
    ],
    analysisLimit: Infinity,
    creditsPerMonth: 3000,
    stripeLink: STRIPE_EXECUTIVE_PLAN_LINK,
  },
};

export const BUSINESS_PLANS: { [key: string]: Plan & { key: string } } = {
  starter: {
    key: 'starter',
    name: 'Starter',
    price: '$79',
    priceDescription: 'CAD per month',
    features: ['8 active job posts', 'AI job description generator', 'Basic candidate matching', 'Custom AI endpoint'],
    analysisLimit: 0,
    creditsPerMonth: 0,
    stripeLink: STRIPE_ESSENTIALS_PLAN_LINK,
  },
  growth: {
    key: 'growth',
    name: 'Growth',
    price: '$199',
    priceDescription: 'CAD per month',
    features: ['20 active job posts', 'Advanced candidate matching', 'Company branding analytics', 'Custom AI endpoint'],
    analysisLimit: 0,
    creditsPerMonth: 0,
    stripeLink: STRIPE_ACCELERATOR_PLAN_LINK,
  },
  pro: {
    key: 'pro',
    name: 'Pro / Enterprise',
    price: '$499',
    priceDescription: 'CAD per month',
    features: ['100 active job posts', 'Verified talent access', 'Priority support and insights', 'Custom AI endpoint'],
    analysisLimit: 0,
    creditsPerMonth: 0,
    stripeLink: STRIPE_EXECUTIVE_PLAN_LINK,
  },
  single_post: {
    key: 'single_post',
    name: 'Single Job Post',
    price: '$299',
    priceDescription: '30-day listing',
    features: ['Featured on candidate dashboard', 'Access to AI-matching summary', 'Standard support'],
    analysisLimit: 0, // Not applicable
    creditsPerMonth: 0,
    stripeLink: STRIPE_ESSENTIALS_PLAN_LINK,
  },
  job_pack: {
    key: 'job_pack',
    name: 'Job Pack (5 Posts)',
    price: '$999',
    priceDescription: 'Save 33%',
    features: ['5 job post credits', 'Access to Verified Talent Pool', 'Enhanced company branding', 'Priority support'],
    analysisLimit: 0, // Not applicable
    creditsPerMonth: 0,
    stripeLink: STRIPE_ACCELERATOR_PLAN_LINK,
  },
};


// For legacy compatibility where only free/premium existed
export const PRICING_PLANS = {
    free: ALL_PLANS.free,
    premium: ALL_PLANS.executive, // Mapping old 'premium' to the highest tier for any lingering checks
};

export const PLAN_HIERARCHY: { [key: string]: number } = {
  free: 0,
  essentials: 1,
  accelerator: 2,
  executive: 3,
};

export const TOOL_ACCESS: { [key: string]: string } = {
    'resume-formatter': 'essentials',
    'cover-letter': 'essentials',
    'linkedin-optimizer': 'essentials',
    'email-crafter': 'essentials',
    'opportunity-finder': 'accelerator',
    'mock-interview': 'accelerator',
    'english-pro': 'accelerator',
    'agile-coach': 'accelerator',
    'performance-review-prep': 'accelerator',
    'career-path': 'executive',
    'salary-negotiation': 'executive',
    'website-builder': 'executive',
    'networking-assistant': 'executive',
    'skill-learning-plan': 'executive',
    'industry-event-scout': 'executive',
};

// This function is now less relevant with the credit system but can be kept for future feature gating.
export const hasAccess = (userPlan: string, requiredPlan: string): boolean => {
    const userLevel = PLAN_HIERARCHY[userPlan] ?? 0;
    const requiredLevel = PLAN_HIERARCHY[requiredPlan] ?? 99;
    return userLevel >= requiredLevel;
};
