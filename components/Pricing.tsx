
import React, { useState } from 'react';
import type { Plan, UserProfile } from '../types';
import { ALL_PLANS, PLAN_HIERARCHY, STRIPE_CUSTOMER_PORTAL_LINK } from '../config';
import { CREDIT_PACKS } from '../config/credits';
import type { Session } from '@supabase/supabase-js';

// --- PROPS ---

interface PricingProps {
    session: Session | null;
    profile: UserProfile | null;
    setView: (view: 'auth', authView?: 'sign_in' | 'sign_up') => void;
    navigateToAccount: () => void;
    t: (key: string) => string;
}

interface SubscriptionCardProps {
    plan: Plan & { key: string };
    isFeatured?: boolean;
    onSelectPlan: (plan: Plan & { key: string }) => void;
    isProcessing?: boolean;
    isCurrentPlan?: boolean;
    userPlanLevel: number;
    onManageSubscription: () => void;
    t: (key: string) => string;
}

interface CreditPackCardProps {
    pack: {
        key: string;
        name: string;
        credits: number;
        price: string;
        priceDescription: string;
        stripeLink: string;
    };
    onPurchase: (pack: any) => void;
    t: (key: string) => string;
}

// --- SUB-COMPONENTS ---

const SubscriptionCard: React.FC<SubscriptionCardProps> = ({ plan, isFeatured = false, onSelectPlan, isProcessing = false, isCurrentPlan = false, userPlanLevel, onManageSubscription, t }) => {
    const cardPlanLevel = PLAN_HIERARCHY[plan.key] ?? 0;

    const getButtonText = () => {
        if (isCurrentPlan) {
            return plan.key === 'free' ? 'Your Current Plan' : 'Manage Subscription';
        }
        if (isProcessing) return 'Redirecting...';
        
        if (userPlanLevel !== -1) { // User is logged in
             if (cardPlanLevel > userPlanLevel) {
                return 'Upgrade Plan';
            }
            if (cardPlanLevel < userPlanLevel && plan.key !== 'free') {
                return 'Downgrade Plan';
            }
        }
        
        return plan.key === 'free' ? 'Get Started Free' : 'Choose Plan';
    };

    const handleClick = isCurrentPlan && onManageSubscription && plan.key !== 'free' ? onManageSubscription : () => onSelectPlan(plan);
    const isDisabled = isProcessing || (isCurrentPlan && plan.key === 'free');

    return (
        <div className={`relative flex flex-col p-8 rounded-2xl border-2 shadow-lg transition-all ${isFeatured ? 'bg-slate-900 text-white border-blue-600' : 'bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 border-gray-200 dark:border-slate-700'}`}>
            {isFeatured && <div className="absolute top-0 -translate-y-1/2 left-1/2 -translate-x-1/2 bg-gradient-to-r from-blue-600 to-indigo-700 px-4 py-1.5 text-sm font-semibold uppercase tracking-wider text-white rounded-full shadow-md">Most Popular</div>}
            
            <div className="flex-grow">
                <h3 className="text-xl font-bold">{plan.name}</h3>
                <div className="mt-4 flex items-baseline">
                    <span className="text-5xl font-extrabold tracking-tight">{plan.price}</span>
                    {plan.price !== '$0' && <span className="ml-1 text-sm font-medium opacity-70">{plan.priceDescription}</span>}
                </div>

                <p className={`mt-6 text-lg font-semibold ${isFeatured ? 'text-blue-300' : 'text-blue-600'}`}>{plan.creditsPerMonth.toLocaleString()} credits / month</p>
                
                <ul role="list" className="mt-6 space-y-3 text-sm leading-6 flex-grow">
                    {plan.features.map((feature, index) => (
                        <li key={index} className="flex gap-x-3">
                            <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 flex-none ${isFeatured ? 'text-blue-400' : 'text-blue-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                            <span className="opacity-90">{feature}</span>
                        </li>
                    ))}
                </ul>
            </div>
            
            <button
                onClick={handleClick}
                disabled={isDisabled}
                className={`mt-8 w-full rounded-lg px-6 py-3 text-sm font-semibold leading-6 shadow-sm transition-all duration-300
                    ${isDisabled ? 'opacity-60 cursor-not-allowed' : ''}
                    ${isCurrentPlan ? `bg-gray-100 dark:bg-slate-700 text-gray-500` :
                    isFeatured 
                        ? 'bg-blue-600 text-white hover:bg-blue-500' 
                        : `text-blue-600 ring-2 ring-inset ring-blue-200 dark:ring-slate-600 hover:ring-blue-400 dark:hover:bg-slate-700 bg-transparent`
                    }`}
            >
                {getButtonText()}
            </button>
        </div>
    );
};

const CreditPackCard: React.FC<CreditPackCardProps> = ({ pack, onPurchase, t }) => (
    <div className="flex flex-col p-6 rounded-2xl border-2 border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-md text-center transition-all hover:shadow-xl hover:border-blue-400 dark:hover:border-blue-500">
        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">{pack.name}</h3>
        <p className="mt-4 text-5xl font-extrabold text-blue-600 dark:text-blue-400 tracking-tight">{pack.credits.toLocaleString()}</p>
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Credits</p>
        <div className="flex-grow"></div>
        <p className="mt-6 text-xl font-semibold text-gray-800 dark:text-gray-200">{pack.price}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400">{pack.priceDescription}</p>
        <button onClick={() => onPurchase(pack)} className="mt-6 w-full bg-green-600 text-white font-semibold py-2.5 rounded-lg shadow-sm hover:bg-green-700 transition-colors">
            Buy Now
        </button>
    </div>
);

// --- MAIN COMPONENT ---

const Pricing: React.FC<PricingProps> = ({ session, profile, setView, navigateToAccount, t }) => {
    const [isSubscribing, setIsSubscribing] = useState(false);

    const handleGetStarted = (plan: Plan & { key: string }) => {
        if (!session) {
            sessionStorage.setItem('pending_plan', plan.key);
            sessionStorage.setItem('pending_mode', 'candidate');
            setView('auth', 'sign_up');
            return;
        }

        if (plan.key === 'free' || !plan.stripeLink) return;

        setIsSubscribing(true);
        const stripeUrl = new URL(plan.stripeLink);
        stripeUrl.searchParams.append('client_reference_id', session.user.id);
        if (session.user.email) {
            stripeUrl.searchParams.append('prefilled_email', session.user.email);
        }
        window.location.href = stripeUrl.toString();
    };

    const handleManageSubscription = () => {
        setIsSubscribing(true);
        if (session && session.user.email) {
             const portalUrl = new URL(STRIPE_CUSTOMER_PORTAL_LINK);
             portalUrl.searchParams.append('prefilled_email', session.user.email);
             window.location.href = portalUrl.toString();
        } else {
             window.location.href = STRIPE_CUSTOMER_PORTAL_LINK;
        }
    };
    
    const handlePurchaseCredits = (pack: any) => {
        if (!session) {
             setView('auth', 'sign_in');
             return;
        }
        // Placeholder until real Stripe links are provided for one-time purchases
        alert(`Redirecting to purchase ${pack.name}... (This is a placeholder as Stripe links for one-time purchases are not yet configured)`);
        // In a real app: window.location.href = pack.stripeLink;
    };
    
    const currentUserPlanKey = profile?.subscription_status || 'free';
    const currentUserPlanLevel = PLAN_HIERARCHY[currentUserPlanKey] ?? (session ? 0 : -1);

    return (
        <section className="py-16 md:py-24 bg-gray-50 dark:bg-slate-900/50">
            <div className="max-w-6xl mx-auto px-4 sm:px-6">
                <div className="text-center mb-12 animate-slide-in-up">
                    <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 dark:text-gray-100 tracking-tight">Flexible plans for your career journey</h2>
                    <p className="mt-4 text-lg text-gray-600 dark:text-gray-400 max-w-3xl mx-auto">Get a monthly credit allowance with our subscriptions, and top up with credit packs anytime you need more.</p>
                </div>
                
                {/* Subscription Plans */}
                <div className="isolate mx-auto grid max-w-md grid-cols-1 gap-8 lg:max-w-none lg:grid-cols-4">
                    {Object.values(ALL_PLANS).map(plan => (
                        <SubscriptionCard
                            key={plan.key}
                            plan={plan}
                            isFeatured={plan.key === 'accelerator'}
                            onSelectPlan={handleGetStarted}
                            isProcessing={isSubscribing}
                            isCurrentPlan={currentUserPlanKey === plan.key}
                            userPlanLevel={currentUserPlanLevel}
                            onManageSubscription={handleManageSubscription}
                            t={t}
                        />
                    ))}
                </div>

                {/* Credit Packs */}
                 <div className="mt-20">
                    <div className="text-center mb-12 animate-slide-in-up" style={{ animationDelay: '200ms' }}>
                        <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900 dark:text-gray-100 tracking-tight">Need More? Top Up Your Credits</h2>
                        <p className="mt-3 text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">One-time purchases to fuel your job search. Credits never expire.</p>
                    </div>
                     <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 max-w-4xl mx-auto">
                         {CREDIT_PACKS.map(pack => (
                            <CreditPackCard
                                key={pack.key}
                                pack={pack}
                                onPurchase={handlePurchaseCredits}
                                t={t}
                            />
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
};

export default Pricing;
