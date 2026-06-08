
// Stripe links are placeholders for one-time purchases
const STRIPE_CREDIT_PACK_100_LINK = 'https://buy.stripe.com/test_...';
const STRIPE_CREDIT_PACK_500_LINK = 'https://buy.stripe.com/test_...';
const STRIPE_CREDIT_PACK_1000_LINK = 'https://buy.stripe.com/test_...';

export const TOOL_CREDIT_COSTS = {
    'resume-analysis': 10,
    'resume-formatter': 20,
    'opportunity-finder': 50,
    'linkedin-optimizer': 20,
    'cover-letter': 20,
    'mock-interview': 150,
    'career-path': 100,
    'agile-coach': 25,
    'salary-negotiation': 75,
    'english-pro': 15,
    'email-crafter': 5,
    'website-builder': 250,
    'networking-assistant': 40,
    'performance-review-prep': 40,
    'skill-learning-plan': 50,
    'industry-event-scout': 50,
};

// Initial grants or monthly allowances for subscription plans
export const PLAN_CREDITS = {
    free: 50,       // One-time grant for new sign-ups
    essentials: 200,
    accelerator: 750,
    executive: 2000,
};

export const PLAN_MONTHLY_CREDITS = {
    free: 50,
    essentials: 200,
    accelerator: 750,
    executive: 2000,
};

export const BUSINESS_PLAN_CREDITS = {
    single_post: 0,
    job_pack: 0,
};

export const INITIAL_USER_CREDITS = 100;

export const CREDIT_PACKS = [
    {
        key: 'pack_100',
        name: 'Starter Pack',
        credits: 100,
        price: '$2',
        priceDescription: 'one-time purchase',
        stripeLink: STRIPE_CREDIT_PACK_100_LINK,
    },
    {
        key: 'pack_500',
        name: 'Booster Pack',
        credits: 500,
        price: '$8',
        priceDescription: 'one-time purchase (20% off)',
        stripeLink: STRIPE_CREDIT_PACK_500_LINK,
    },
    {
        key: 'pack_1000',
        name: 'Pro Pack',
        credits: 1000,
        price: '$15',
        priceDescription: 'one-time purchase (25% off)',
        stripeLink: STRIPE_CREDIT_PACK_1000_LINK,
    },
];

export const ENGLISH_PRO_PRACTICE_REWARD = 5;
