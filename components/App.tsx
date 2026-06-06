
import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { AnalysisResult, ResumeImage, UserProfile } from './types';
import { analyzeResume } from './services/geminiService';
import { ALL_PLANS, BUSINESS_PLANS, DEFAULT_MARKET } from './config';
import { supabase } from './lib/supabaseClient';
import type { Json } from './lib/supabaseClient';
import type { Session } from '@supabase/supabase-js';
import { useLocalization } from './hooks/useLocalization';
import { ToastProvider } from './components/Toast';

import Header from './components/Header';
import Hero from './components/Hero';
import Features from './components/Features';
import Audience from './components/Audience';
import FAQ from './components/FAQ';
import Footer from './components/Footer';
import UploadSection from './components/UploadSection';
import AnalysisDisplay from './components/AnalysisDisplay';
import LoadingSpinner from './components/LoadingSpinner';
import Pricing from './components/Pricing';
import Auth from './components/Auth';
import Account from './components/Account';
import DevModeModal from './components/DevModeModal';
import ResumePreview from './components/ResumePreview';
import Dashboard from './components/dashboard/Dashboard';
import BusinessPage from './components/BusinessPage';
import EmployerDashboard from './components/EmployerDashboard';
import AgencyHub from './components/AgencyHub';
import CareerCoachBot from './components/CareerCoachBot';
import VerifiedTalentSection from './components/VerifiedTalentSection';

const App: React.FC = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [view, setView] = useState<'home' | 'auth' | 'account' | 'business' | 'agency'>('home');
  const [initialAuthView, setInitialAuthView] = useState<'sign_in' | 'sign_up' | 'forgot_password'>('sign_in');
  const [authMode, setAuthMode] = useState<'candidate' | 'business'>('candidate');

  const [resumeText, setResumeText] = useState<string>('');
  const [resumeImages, setResumeImages] = useState<ResumeImage[] | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [market, setMarket] = useState<string>(DEFAULT_MARKET);
  const [analysisCount, setAnalysisCount] = useState<number>(0);
  const [isRedirecting, setIsRedirecting] = useState<boolean>(false);
  const [isDevModeOpen, setIsDevModeOpen] = useState(false);
  const [isUpdatingResume, setIsUpdatingResume] = useState(false);
  const [showHomePageOverride, setShowHomePageOverride] = useState(false);
  const [isProfileLoaded, setIsProfileLoaded] = useState(false);
  const [dashboardView, setDashboardView] = useState<'dashboard' | 'toolkit' | 'resume'>('dashboard');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');


  const { t, isLoaded: isLangLoaded, currentLang, changeLanguage } = useLocalization();


  const uploadSectionRef = useRef<HTMLDivElement>(null);
  const pricingSectionRef = useRef<HTMLDivElement>(null);
  
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
    localStorage.setItem('theme', theme);
  }, [theme]);
  
  const toggleTheme = () => {
    setTheme(prevTheme => prevTheme === 'light' ? 'dark' : 'light');
  };

  // Effect to determine and set the UI language based on user preferences or browser settings
  useEffect(() => {
    // Priority: Local Storage > Profile (for backward compatibility if it exists) > Browser
    const storedLang = localStorage.getItem('preferred_language');
    const profileLang = profile?.preferred_language;
    const browserLang = navigator.language.split('-')[0];
    const targetLang = storedLang || profileLang || browserLang || 'en';

    if (targetLang && targetLang !== currentLang) {
        changeLanguage(targetLang);
    }
  }, [profile, currentLang, changeLanguage]);


  // Debounced effect to save resume text to the database
  useEffect(() => {
    // Only save after the initial profile load is complete to avoid overwriting DB with initial empty state
    if (session && isProfileLoaded) {
      const handler = setTimeout(async () => {
        if (!session.user) return;
        try {
          const { error } = await supabase
            .from('profiles')
            .update({ resume_text: resumeText })
            .eq('id', session.user.id);
          if (error) {
            console.error('Failed to auto-save resume text:', error.message);
          }
        } catch (err) {
          console.error('Error in auto-save resume text effect:', (err as Error).message);
        }
      }, 1500); // Debounce for 1.5 seconds

      return () => {
        clearTimeout(handler);
      };
    }
  }, [resumeText, session, isProfileLoaded]);


  const getProfile = useCallback(async () => {
    try {
      if (!session?.user) return;
      const user = session.user;

      let { data, error, status } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error && status !== 406) {
        throw error;
      }
      
      if (data) {
        // Profile exists, update state
        setProfile(data);
        setResumeText(data.resume_text || '');
      } else {
        // Profile does not exist, create it. This handles first-time OAuth sign-ins.
        console.log("No profile found for user, creating one.");

        // Check for pending plan from OAuth signup
        const pendingPlan = sessionStorage.getItem('pending_plan');
        const pendingMode = sessionStorage.getItem('pending_mode');
        
        let subscriptionStatus = 'free';
        let role: 'candidate' | 'employer' | 'agency' = 'candidate';

        if (pendingPlan && pendingMode) {
            subscriptionStatus = pendingMode === 'business'
                ? `pending_biz_${pendingPlan}`
                : pendingPlan === 'free' ? 'free' : `pending_${pendingPlan}`;
            role = pendingMode === 'business' ? 'employer' : 'candidate';
            
            // Clear after use
            sessionStorage.removeItem('pending_plan');
            sessionStorage.removeItem('pending_mode');
        }

        const { data: newProfile, error: upsertError } = await supabase
          .from('profiles')
          .upsert({
            id: user.id,
            full_name: user.user_metadata?.full_name || '',
            avatar_url: user.user_metadata?.avatar_url || '',
            subscription_status: subscriptionStatus,
            resume_text: '',
            role: role,
            updated_at: new Date().toISOString()
          })
          .select()
          .single();

        if (upsertError) {
          throw upsertError;
        }

        if (newProfile) {
           setProfile(newProfile);
           setResumeText('');
        }
      }
    } catch (error) {
      console.error('Error in getProfile:', (error as Error).message);
      setError("Could not load your profile. Please try again later.");
    } finally {
        setIsProfileLoaded(true); // Mark profile as loaded
    }
  }, [session]);
  
  const handleSubscriptionRedirect = useCallback(async (planKey: string) => {
    if (!session) {
      setView('auth');
      return;
    }

    setIsRedirecting(true);

    try {
        let targetPlanKey = planKey;
        let plan;

        if (planKey.startsWith('pending_biz_')) {
            targetPlanKey = planKey.replace('pending_biz_', '');
            plan = BUSINESS_PLANS[targetPlanKey as keyof typeof BUSINESS_PLANS];
        } else if (planKey.startsWith('pending_')) {
            targetPlanKey = planKey.replace('pending_', '');
            plan = ALL_PLANS[targetPlanKey];
        } else {
            throw new Error(`Invalid pending plan key format: ${planKey}`);
        }

        if (!plan || !plan.stripeLink) {
            throw new Error(`Stripe payment link is not configured for the ${targetPlanKey} plan.`);
        }
        
        const stripeUrl = new URL(plan.stripeLink);
        stripeUrl.searchParams.append('client_reference_id', session.user.id);
        if (session.user.email) {
            stripeUrl.searchParams.append('prefilled_email', session.user.email);
        }
        
        // Add a short delay to allow the redirect message to be seen
        setTimeout(() => {
            window.open(stripeUrl.toString(), '_blank');
            setIsRedirecting(false);
            // Optionally clear the pending status from the profile if the redirect is successful.
            // A webhook is a more robust solution for this.
        }, 1500);
    } catch (error) {
        setError(`Error preparing for checkout: ${(error as Error).message}`);
        setIsRedirecting(false);
    }
  }, [session]);

  const handleBusinessPlanSelection = async (planKey: string) => {
      if (!session) return;
      try {
          const { error } = await supabase
              .from('profiles')
              .update({ subscription_status: `pending_biz_${planKey}` })
              .eq('id', session.user.id);
          if (error) throw error;
          await getProfile(); // Refresh profile state to trigger redirect effect
      } catch (error) {
          console.error("Error setting business plan:", (error as Error).message);
          alert(`Failed to set plan: ${(error as Error).message}`);
      }
  };
  
  const handleOpenDevMode = () => {
    if (!session) {
      alert("Please sign in to use Dev Mode.");
      return;
    }
    setIsDevModeOpen(true);
  };

  const handleSetPlanForDev = async (planKey: string): Promise<boolean> => {
    if (!session) return false;
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ subscription_status: planKey })
        .eq('id', session.user.id);
      if (error) throw error;
      await getProfile(); // Refresh profile state
      return true;
    } catch (error) {
      console.error("Error setting dev plan:", (error as Error).message);
      alert(`Failed to set plan: ${(error as Error).message}`);
      return false;
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setIsProfileLoaded(false); // Reset profile loaded state on auth change
      if (_event === 'SIGNED_IN') {
        // On sign-in, check if it's a redirect from a successful payment.
        // A secure webhook is the production-ready way, but for this app's logic,
        // we'll refresh the profile to get the latest status set by the (simulated) webhook.
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('payment_success') === 'true') {
            alert("Payment successful! Your plan has been upgraded.");
            // Clean the URL
            window.history.replaceState({}, document.title, window.location.pathname);
        }
        setView('home');
      }
      if (_event === 'SIGNED_OUT') {
        setView('home');
        setProfile(null);
        setAnalysisResult(null); // Clear analysis on sign out
        setResumeText(''); // Clear resume text on sign out
        sessionStorage.clear(); // Clear session storage on sign out
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) {
        // Determine initial resume update state only after profile is loaded
        if (isProfileLoaded) {
            setIsUpdatingResume(!resumeText);
        }
    }
  }, [session, isProfileLoaded, resumeText]);


  useEffect(() => {
    const handleStripeRedirect = () => {
        const urlParams = new URLSearchParams(window.location.search);
        
        // --- Handle Cancellation ---
        if (urlParams.get('payment_cancelled') === 'true') {
            alert('Your payment was cancelled. You can try again anytime from the pricing section.');
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    };

    if (session) {
      getProfile();
    }
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
    setAnalysisResult(null);
    setView('home');
    setShowHomePageOverride(true); // Force homepage view to show pricing
    setTimeout(() => {
        pricingSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };
  
  const navigateToBusinessPricing = () => {
      setView('business');
  };

  const navigateToAccount = () => {
    setShowHomePageOverride(false); // Turn off override when going to account
    setView('account');
  };

  const handleSetView = (view: 'home' | 'auth' | 'account' | 'business' | 'agency', authView: 'sign_in' | 'sign_up' | 'forgot_password' = 'sign_in', mode: 'candidate' | 'business' = 'candidate') => {
    if (view !== 'home') {
        setShowHomePageOverride(false); // Turn off override if navigating to auth or account
    } else {
        // If user is logged in and clicks a "home" link, go to the dashboard
        // AND RESET dashboard navigation state to ensure they land on the main dashboard view
        setDashboardView('dashboard');
        setShowHomePageOverride(false);
    }
    
    if (view === 'auth') {
        setInitialAuthView(authView);
        setAuthMode(mode);
    }
    setView(view);
  };


  const userPlan = profile?.subscription_status || 'free';
  const currentPlanDetails = ALL_PLANS[userPlan] || ALL_PLANS.free;


  const handleScrollToUpload = () => {
    uploadSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (userPlan === 'free' && analysisCount >= currentPlanDetails.analysisLimit) {
      setError("You've used your free analysis for this month. Please upgrade for unlimited analyses.");
      pricingSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
      return;
    }

    if (!resumeText.trim() && (!resumeImages || resumeImages.length === 0)) {
      setError('Please provide your resume before analyzing.');
      return;
    }
    setIsLoading(true);
    setError(null);
    setAnalysisResult(null);

    try {
      const result = await analyzeResume(resumeText, resumeImages, market);
      
      // --- START: Save analysis data for dashboard ---
      if (session?.user) {
        try {
            // Step 1: Log the tool usage event and get its ID.
            const { data: eventData, error: eventError } = await supabase
              .from('tool_usage_events')
              .insert({
                user_id: session.user.id,
                tool_key: 'resume-analysis',
                metadata: { market },
              })
              .select()
              .single();

            if (eventError) throw eventError;
            
            // Step 2: Save the detailed analysis result, linking it to the event.
            const { error: analysisError } = await supabase
              .from('resume_analyses')
              .insert({
                user_id: session.user.id,
                event_id: eventData?.event_id,
                score: result.score,
                market_name: market,
                summary: result.summary,
                strengths: result.strengths,
                improvements: result.improvements as unknown as Json,
                keywords: result.keywords,
              });

            if (analysisError) throw analysisError;

        } catch (dbError) {
            // Log the DB error but don't block the UI. The user still gets their analysis.
            console.error("Error saving analysis to database:", (dbError as Error).message);
        }
      }
      // --- END: Save analysis data ---
      
      setAnalysisResult(result);
      if (result.extractedText) {
          // This will trigger the debounced save effect
          setResumeText(result.extractedText);
      }
      if (userPlan === 'free') {
        setAnalysisCount(prev => prev + 1);
      }
      // After analysis, no longer updating resume
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
  
  const handleReset = () => {
    setAnalysisResult(null);
    setError(null);
    setResumeImages(null);
    setShowHomePageOverride(false); // Go back to dashboard view
    setDashboardView('dashboard'); // Default back to the main dashboard
  };

  const handleApplyImprovements = (newText: string) => {
    // This will trigger the debounced save to DB
    setResumeText(newText);
    // The analysis is now outdated for the new text, so reset the view
    // which takes user back to the dashboard.
    handleReset();
  };

  const renderHomePage = () => (
    <>
      <Hero onUploadClick={handleScrollToUpload} t={t} />

      <div id="upload-section" ref={uploadSectionRef} className="my-16 md:my-24 scroll-mt-20">
        <UploadSection
          t={t}
          resumeText={resumeText}
          setResumeText={setResumeText}
          resumeImages={resumeImages}
          setResumeImages={setResumeImages}
          onSubmit={handleSubmit}
          isLoading={isLoading}
          error={error}
          setError={setError}
          userPlan={userPlan}
          analysisCount={analysisCount}
          market={market}
          setMarket={setMarket}
        />
      </div>

      <div id="features-section" className="scroll-mt-20">
        <Features t={t} />
      </div>
      
      <div id="verified-talent-section" className="scroll-mt-20">
        <VerifiedTalentSection t={t} />
      </div>

      <div id="pricing-section" ref={pricingSectionRef} className="scroll-mt-20">
        <Pricing t={t} session={session} profile={profile} setView={handleSetView} onSubscriptionChange={getProfile} navigateToAccount={navigateToAccount} />
      </div>
      
      <div id="audience-section" className="scroll-mt-20">
          <Audience t={t} />
      </div>
      
      <div id="faq-section" className="scroll-mt-20">
        <FAQ t={t} />
      </div>
    </>
  );

  const renderDashboard = () => (
    <div className="my-8 md:my-12">
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tighter text-gray-900 dark:text-gray-100 text-center mb-4 animate-slide-in-up">
            {t('dashboard_welcome')} <span className="text-blue-700">{profile?.full_name || session?.user?.email || 'there'}</span>!
        </h1>
        
        {isUpdatingResume || !resumeText ? (
             <div className="mt-12 animate-slide-in-up">
                <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto text-center mb-12" style={{ animationDelay: '100ms' }}>
                    {resumeText ? t('dashboard_update_prompt') : t('dashboard_new_user_prompt')}
                </p>
                <div id="upload-section" ref={uploadSectionRef} className="scroll-mt-20">
                    <UploadSection
                      t={t}
                      resumeText={resumeText}
                      setResumeText={setResumeText}
                      resumeImages={resumeImages}
                      setResumeImages={setResumeImages}
                      onSubmit={handleSubmit}
                      isLoading={isLoading}
                      error={error}
                      setError={setError}
                      userPlan={userPlan}
                      analysisCount={analysisCount}
                      market={market}
                      setMarket={setMarket}
                    />
                </div>
                 {resumeText && ( // Add a cancel button if they were updating
                    <div className="text-center mt-6">
                        <button onClick={() => setIsUpdatingResume(false)} className="text-sm text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100 font-semibold bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 px-6 py-2 rounded-lg transition-colors">{t('dashboard_cancel_update')}</button>
                    </div>
                )}
            </div>
        ) : (
            <div className="mt-8 animate-slide-in-up">
                {/* Button Bar - Now Sticky */}
                <div className="sticky top-20 z-30 bg-gray-50/95 dark:bg-gray-950/95 backdrop-blur-sm pt-2 pb-1 border-b border-gray-200 dark:border-gray-700 mb-8 flex justify-center" role="tablist" aria-label="Dashboard Content">
                    <div className="flex gap-2 p-1 bg-gray-200 dark:bg-slate-800 rounded-lg">
                        <button
                            onClick={() => setDashboardView('dashboard')}
                            role="tab"
                            aria-selected={dashboardView === 'dashboard'}
                            className={`px-4 sm:px-6 py-2 rounded-md font-semibold text-sm sm:text-base transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-blue-400 ${dashboardView === 'dashboard' ? 'bg-white dark:bg-slate-600 text-blue-700 dark:text-blue-100 shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'}`}
                        >
                             <div className="flex items-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
                                <span className="hidden sm:inline">{t('dashboard_tab_dashboard')}</span>
                                <span className="sm:hidden">Dash</span>
                            </div>
                        </button>
                        <button
                            onClick={() => setDashboardView('toolkit')}
                            role="tab"
                            aria-selected={dashboardView === 'toolkit'}
                            className={`px-4 sm:px-6 py-2 rounded-md font-semibold text-sm sm:text-base transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-blue-400 ${dashboardView === 'toolkit' ? 'bg-white dark:bg-slate-600 text-blue-700 dark:text-blue-100 shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'}`}
                        >
                             <div className="flex items-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
                                <span className="hidden sm:inline">{t('dashboard_tab_toolkit')}</span>
                                <span className="sm:hidden">Tools</span>
                            </div>
                        </button>
                        <button
                            onClick={() => setDashboardView('resume')}
                            role="tab"
                            aria-selected={dashboardView === 'resume'}
                            className={`px-4 sm:px-6 py-2 rounded-md font-semibold text-sm sm:text-base transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-blue-400 ${dashboardView === 'resume' ? 'bg-white dark:bg-slate-600 text-blue-700 dark:text-blue-100 shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'}`}
                        >
                            <div className="flex items-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                <span className="hidden sm:inline">{t('dashboard_tab_my_resume')}</span>
                                <span className="sm:hidden">Resume</span>
                            </div>
                        </button>
                    </div>
                </div>
                
                {/* Conditional Content */}
                {dashboardView === 'dashboard' && (
                    <div id="dashboard-panel" role="tabpanel" aria-labelledby="dashboard-tab">
                        <Dashboard session={session} profile={profile} t={t} />
                    </div>
                )}
                {dashboardView === 'toolkit' && (
                    <div id="toolkit-panel" role="tabpanel" aria-labelledby="toolkit-tab">
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
                        />
                    </div>
                )}
                {dashboardView === 'resume' && (
                    <div id="resume-panel" role="tabpanel" aria-labelledby="resume-tab" className="max-w-4xl mx-auto">
                         <div className="p-6 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl shadow-sm">
                            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-4">{t('dashboard_resume_title')}</h2>
                            <ResumePreview resumeText={resumeText} market={market} t={t} />
                            <div className="mt-4 text-center">
                                <button onClick={() => setIsUpdatingResume(true)} className="bg-gray-100 dark:bg-slate-700 text-gray-800 dark:text-gray-200 font-semibold py-2 px-6 rounded-lg shadow-sm border border-gray-200 dark:border-slate-600 hover:bg-gray-200 dark:hover:bg-slate-600 transition-all">
                                    {t('dashboard_update_button')}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        )}
    </div>
  );

  const renderContent = () => {
    if (view === 'auth') {
        return <Auth t={t} onClose={() => setView('home')} initialView={initialAuthView} mode={authMode} />;
    }
    if (view === 'account' && session) {
        return <Account key={session.user.id} session={session} onClose={() => setView('home')} onSubscriptionChange={getProfile} navigateToPricing={navigateToPricing} t={t} />;
    }
    if (view === 'business') {
        return <BusinessPage 
            t={t}
            session={session} 
            profile={profile} 
            onPostJobClick={() => handleSetView('auth', 'sign_up', 'business')} 
            onSignInClick={() => handleSetView('auth', 'sign_in', 'business')}
            onSelectBusinessPlan={handleBusinessPlanSelection}
            onBack={() => handleSetView('home')}
        />;
    }
    if (view === 'agency' && session && profile) {
        return <AgencyHub session={session} profile={profile} t={t} />;
    }

    if (isLoading) {
      return <LoadingSpinner market={market} />;
    }

    if (analysisResult) {
      return <AnalysisDisplay t={t} result={analysisResult} onReset={handleReset} resumeText={resumeText} userPlan={userPlan} market={market} navigateToPricing={navigateToPricing} session={session} profile={profile} refreshProfile={getProfile} onApplyImprovements={handleApplyImprovements} />;
    }

    if (session && !showHomePageOverride) {
        // Show a loading state for the dashboard while profile is being fetched
        if (!isProfileLoaded || !isLangLoaded) {
            return (
                <div className="flex flex-col items-center justify-center space-y-4 my-24">
                    <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-700 rounded-full animate-spin"></div>
                    <p className="text-lg text-gray-600 dark:text-gray-400">{t('dashboard_loading')}</p>
                </div>
            );
        }
        
        if (profile?.role === 'employer' && session && profile) {
            return <EmployerDashboard session={session} profile={profile} refreshProfile={getProfile} navigateToBusinessPricing={navigateToBusinessPricing} t={t} />;
        }
        
        return renderDashboard();
    }
    
    if (!isLangLoaded) {
        return (
            <div className="flex flex-col items-center justify-center space-y-4 my-24">
                <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-700 rounded-full animate-spin"></div>
                <p className="text-lg text-gray-600">Loading...</p>
            </div>
        );
    }
    
    return renderHomePage();
  };

  return (
    <ToastProvider>
      <div className="min-h-screen w-full bg-gray-50 text-gray-800 dark:bg-gray-950 dark:text-gray-200 font-sans">
        <style>{`
          @keyframes fade-in {
            from { opacity: 0; transform: translateY(-10px); }
            to { opacity: 1; transform: translateY(0); }
          }
          @keyframes slide-in-up {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
          }
          @keyframes pulse-mic {
            0%, 100% {
              transform: scale(1);
              opacity: 1;
            }
            50% {
              transform: scale(1.2);
              opacity: 0.7;
            }
          }
          @keyframes pulse-glow {
            0%, 100% {
              opacity: 0.8;
              transform: scale(1);
            }
            50% {
              opacity: 1;
              transform: scale(1.05);
            }
          }
          @keyframes aurora {
            from { background-position: 50% 50%, 50% 50%; }
            to { background-position: 350% 50%, 350% 50%; }
          }
          @keyframes holographic-text {
            0%, 100% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
          }
          @keyframes crystal-glow {
            0%, 100% {
              filter: drop-shadow(0 0 4px rgba(251, 191, 36, 0.6));
            }
            50% {
              filter: drop-shadow(0 0 10px rgba(251, 191, 36, 0.9));
            }
          }
          .animate-fade-in { animation: fade-in 0.5s ease-out forwards; }
          .animate-slide-in-up { animation: slide-in-up 0.6s ease-out forwards; }
          .animate-pulse-mic { animation: pulse-mic 1.5s ease-in-out infinite; }
          .animate-pulse-glow { animation: pulse-glow 3s ease-in-out infinite; }
          .animate-aurora { animation: aurora 20s infinite linear; }
          .animate-holographic-text { animation: holographic-text 5s infinite linear; }
          .animate-crystal-glow { animation: crystal-glow 2.5s ease-in-out infinite; }
          .static-crystal-glow { filter: drop-shadow(0 0 5px rgba(251, 191, 36, 0.7)); }
        `}</style>

        {isRedirecting && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[999] p-4 animate-fade-in">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl p-8 text-center flex flex-col items-center">
              <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">Finalizing Your Upgrade!</h3>
              <p className="mt-2 text-gray-600 dark:text-gray-300">To activate your new plan, we're opening our secure payment page.</p>
              <div className="mt-6 w-12 h-12 border-4 border-blue-200 border-t-blue-700 rounded-full animate-spin"></div>
            </div>
          </div>
        )}
        
        {isDevModeOpen && session && (
          <DevModeModal
            session={session}
            profile={profile}
            onClose={() => setIsDevModeOpen(false)}
            onSetPlan={handleSetPlanForDev}
          />
        )}

        <Header session={session} profile={profile} onSetView={handleSetView} t={t} changeLanguage={changeLanguage} currentLang={currentLang} theme={theme} toggleTheme={toggleTheme} view={view} />

        <main className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {renderContent()}
        </main>

        {/* The footer is only shown on the public-facing homepage (when not logged in, or when overriding to show pricing), not on the user's dashboard. */}
        {(!session || showHomePageOverride) && <Footer onOpenDevMode={handleOpenDevMode} t={t} changeLanguage={changeLanguage} currentLang={currentLang} />}
        
        {/* Career Coach FAB */}
         <button
          onClick={() => setIsChatOpen(true)}
          className="fixed bottom-6 right-6 bg-gradient-to-br from-blue-600 to-indigo-700 text-white w-16 h-16 rounded-full shadow-lg hover:shadow-xl transform hover:scale-110 transition-all duration-300 z-40 flex items-center justify-center"
          aria-label="Open AI Career Coach"
         >
            <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M16.82 7.18002C16.82 5.58002 15.42 4.18002 13.82 4.18002C12.22 4.18002 10.82 5.58002 10.82 7.18002C10.82 8.78002 12.22 10.18 13.82 10.18C15.42 10.18 16.82 8.78002 16.82 7.18002Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M12 14.63H15.63" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M19.13 9.32002C20.94 11.52 20.73 14.6 18.6 16.59C16.47 18.58 13.06 18.74 11.02 16.94L7.52002 20.44C7.14002 20.82 6.51002 20.82 6.13002 20.44L4.21002 18.52C3.83002 18.14 3.83002 17.51 4.21002 17.13L7.71002 13.63C5.91002 11.59 5.75002 8.43002 7.74002 6.30002" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
         </button>

         {isChatOpen && (
          <CareerCoachBot
            isOpen={isChatOpen}
            onClose={() => setIsChatOpen(false)}
            session={session}
            profile={profile}
            resumeText={resumeText}
            t={t}
          />
        )}
      </div>
    </ToastProvider>
  );
};

export default App;
