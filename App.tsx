

import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { AnalysisResult, ResumeImage, UserProfile } from './types';
import { analyzeResume, setApiStatusUpdater } from './services/geminiService';
import { ALL_PLANS, BUSINESS_PLANS, DEFAULT_MARKET } from './config';
import { supabase } from './lib/supabaseClient';
import type { Json } from './lib/supabaseClient';
import type { Session } from '@supabase/supabase-js';
import { useLocalization } from './hooks/useLocalization';
import { FileText } from 'lucide-react';
import { ToastProvider } from './components/Toast';
import { CreditsProvider, useCredits } from './contexts/CreditsContext';
import { ApiStatusProvider, useApiStatus } from './contexts/ApiStatusContext';
import { SettingsProvider, useSettings } from './contexts/SettingsContext';
import ApiStatusBanner from './components/ApiStatusBanner';
import CreditModal from './components/modals/CreditModal';
import { TOOL_CREDIT_COSTS, PLAN_CREDITS } from './config/credits';

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
import Sidebar from './components/Sidebar';
import BusinessPage from './components/BusinessPage';
import EmployerDashboard from './components/EmployerDashboard';
import AgencyHub from './components/AgencyHub';
import CareerCoachBot from './components/CareerCoachBot';
import VerifiedTalentSection from './components/VerifiedTalentSection';
import ApiDocsViewer from './components/ApiDocsViewer';

const AppContent: React.FC = () => {
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
  const [isDevModeOpen, setIsDevModeOpen] = useState(false);
  const [isUpdatingResume, setIsUpdatingResume] = useState(false);
  const [showHomePageOverride, setShowHomePageOverride] = useState(false);
  const [isProfileLoaded, setIsProfileLoaded] = useState(false);
  const [dashboardView, setDashboardView] = useState<'dashboard' | 'toolkit' | 'resume' | 'portfolio' | 'account' | 'credentials' | 'business'>('dashboard');
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  const { credits, setCredits, deductCredits } = useCredits();
  const { isAIMode, toggleAIMode } = useSettings();
  const [isCreditModalOpen, setIsCreditModalOpen] = useState(false);
  const analysisCost = TOOL_CREDIT_COSTS['resume-analysis'];

  const { t, isLoaded: isLangLoaded, currentLang, changeLanguage } = useLocalization();
  const { setApiStatus, setLastError } = useApiStatus();

  useEffect(() => {
    setApiStatusUpdater((status, errorMsg) => {
        setApiStatus(status);
        if (errorMsg) {
            setLastError(errorMsg);
        }
    });
  }, [setApiStatus, setLastError]);


  const uploadSectionRef = useRef<HTMLDivElement>(null);
  const pricingSectionRef = useRef<HTMLDivElement>(null);
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
    localStorage.setItem('theme', theme);
  }, [theme]);
  
  const toggleTheme = () => {
    setTheme(prevTheme => prevTheme === 'light' ? 'dark' : 'light');
  };

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


  // Debounced effect to save resume text to the database
  useEffect(() => {
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
      }, 1500);

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
        setProfile(data);
        setResumeText(data.resume_text || '');
        
        let userCredits = data.credits || 0;
        // Specifically assign 5000 credits to abhishek.ip@gmail.com
        if (user.email === 'abhishek.ip@gmail.com' && userCredits < 5000) {
          userCredits = 5000;
          supabase.from('profiles').update({ credits: userCredits }).eq('id', user.id).then(({ error }) => {
             if (error) console.error('Failed to update specific user credits:', error);
          });
        }
        
        setCredits(userCredits);
      } else {
        console.log("No profile found for user, creating one.");

        const pendingPlan = sessionStorage.getItem('pending_plan');
        const pendingMode = sessionStorage.getItem('pending_mode');
        
        let subscriptionStatus = 'free';
        let role: 'candidate' | 'employer' | 'agency' = 'candidate';
        const initialCredits = user.email === 'abhishek.ip@gmail.com' ? 5000 : PLAN_CREDITS.free;

        if (pendingPlan && pendingMode) {
            subscriptionStatus = pendingMode === 'business'
                ? `pending_biz_${pendingPlan}`
                : pendingPlan === 'free' ? 'free' : `pending_${pendingPlan}`;
            role = pendingMode === 'business' ? 'employer' : 'candidate';
            
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
            credits: initialCredits,
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
           setCredits(initialCredits);
        }
      }
    } catch (error) {
      console.error('Error in getProfile:', (error as Error).message);
      setError("Could not load your profile. Please try again later.");
    } finally {
        setIsProfileLoaded(true);
    }
  }, [session, setCredits]);

  // Set default view for employers
  useEffect(() => {
    if (isProfileLoaded && profile?.role === 'employer' && dashboardView === 'dashboard') {
        setDashboardView('business');
    }
  }, [isProfileLoaded, profile?.role, dashboardView]);
  
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
        
        setTimeout(() => {
            window.open(stripeUrl.toString(), '_blank');
            setIsRedirecting(false);
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
          await getProfile();
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
      await getProfile();
      return true;
    } catch (error) {
      console.error("Error setting dev plan:", (error as Error).message);
      alert(`Failed to set plan: ${(error as Error).message}`);
      return false;
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      currentUserIdRef.current = session?.user?.id ?? null;
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const newUserId = session?.user?.id ?? null;
      const userChanged = newUserId !== currentUserIdRef.current;
      currentUserIdRef.current = newUserId;

      setSession(session);

      if (_event === 'SIGNED_OUT') {
        setView('home');
        setProfile(null);
        setAnalysisResult(null);
        setResumeText('');
        setCredits(0);
        sessionStorage.clear();
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
            alert("Payment successful! Your plan has been upgraded.");
            window.history.replaceState({}, document.title, window.location.pathname);
          }
          setView('home');
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [setCredits]);

  useEffect(() => {
    if (session) {
        if (isProfileLoaded) {
            setIsUpdatingResume(!resumeText);
        }
    }
  }, [session, isProfileLoaded, resumeText]);


  useEffect(() => {
    const handleStripeRedirect = () => {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('payment_cancelled') === 'true') {
            alert('Your payment was cancelled. You can try again anytime from the pricing section.');
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
    setAnalysisResult(null);
    setView('home');
    setShowHomePageOverride(true);
    setTimeout(() => {
        pricingSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };
  
  const navigateToBusinessPricing = () => { setView('business'); };
  const navigateToAccount = () => { setShowHomePageOverride(false); setView('account'); };

  const handleSetView = (view: 'home' | 'auth' | 'account' | 'business' | 'agency' | 'api_docs', authView: 'sign_in' | 'sign_up' | 'forgot_password' = 'sign_in', mode: 'candidate' | 'business' = 'candidate') => {
    if (view !== 'home') { setShowHomePageOverride(false); }
    else { setDashboardView('dashboard'); setShowHomePageOverride(false); }
    if (view === 'auth') { setInitialAuthView(authView); setAuthMode(mode); }
    setView(view);
  };


  const userPlan = profile?.subscription_status || 'free';

  const handleScrollToUpload = () => uploadSectionRef.current?.scrollIntoView({ behavior: 'smooth' });

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
            const { data: eventData, error: eventError } = await supabase.from('tool_usage_events').insert({ user_id: session.user.id, tool_key: 'resume-analysis', metadata: { market } }).select().single();
            if (eventError) throw eventError;
            const { error: analysisError } = await supabase.from('resume_analyses').insert({ user_id: session.user.id, event_id: eventData?.event_id, score: result.score, market_name: market, summary: result.summary, strengths: result.strengths, improvements: result.improvements as unknown as Json, keywords: result.keywords });
            if (analysisError) throw analysisError;
        } catch (dbError) {
            console.error("Error saving analysis to database:", (dbError as Error).message);
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

  const renderHomePage = () => (
    <>
      <Hero onUploadClick={handleScrollToUpload} t={t} />
      <div id="upload-section" ref={uploadSectionRef} className="my-16 md:my-24 scroll-mt-20">
        <UploadSection t={t} resumeText={resumeText} setResumeText={setResumeText} resumeImages={resumeImages} setResumeImages={setResumeImages} onInitiateAnalysis={handleInitiateAnalysis} isLoading={isLoading} error={error} setError={setError} market={market} setMarket={setMarket} />
      </div>
      <div id="features-section" className="scroll-mt-20"><Features t={t} /></div>
      <div id="verified-talent-section" className="scroll-mt-20"><VerifiedTalentSection t={t} /></div>
      <div id="pricing-section" ref={pricingSectionRef} className="scroll-mt-20"><Pricing t={t} session={session} profile={profile} setView={handleSetView} navigateToAccount={navigateToAccount} /></div>
      <div id="audience-section" className="scroll-mt-20"><Audience t={t} /></div>
      <div id="faq-section" className="scroll-mt-20"><FAQ t={t} /></div>
    </>
  );

  const renderDashboard = () => (
    <div className="flex flex-col gap-6 animate-slide-in-up">
        {dashboardView === 'dashboard' && (
            <>
                <h1 className="text-3xl md:text-4xl font-extrabold tracking-tighter text-gray-900 dark:text-gray-100 mb-2">
                    Welcome back, <span className="text-blue-700 dark:text-blue-400">{profile?.full_name?.split(' ')[0] || 'there'}</span>
                </h1>
                <p className="text-gray-600 dark:text-gray-400 mb-8">{t('dashboard_subtitle')}</p>
                <div id="dashboard-panel"><Dashboard session={session} profile={profile} t={t} /></div>
            </>
        )}
        
        {dashboardView === 'toolkit' && (
            <div id="toolkit-panel">
                {!isAIMode ? (
                    <div className="flex flex-col items-center justify-center p-12 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 text-center animate-fade-in min-h-[60vh]">
                        <div className="text-5xl mb-4">🤖</div>
                        <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">AI Mode Recommended</h3>
                        <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto mb-6">The AI Toolkit features professional career tools powered by advanced AI models. Enable AI Mode from the sidebar to access them.</p>
                        <button onClick={() => setDashboardView('portfolio')} className="text-blue-600 dark:text-blue-400 font-bold hover:underline">Or try the Professional Showcase (AI optional) &rarr;</button>
                    </div>
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
            <div id="resume-panel" className="max-w-4xl mx-auto w-full">
                <div className="p-8 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl shadow-sm">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t('dashboard_resume_title')}</h2>
                        <button onClick={() => setIsUpdatingResume(true)} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg shadow-sm transition-all text-sm">
                            <FileText className="h-4 w-4" />
                            Update Resume
                        </button>
                    </div>
                    <ResumePreview resumeText={resumeText} market={market} t={t} />
                </div>
            </div>
        )}

        {dashboardView === 'portfolio' && (
            <div id="portfolio-panel">
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
            </div>
        )}

        {dashboardView === 'credentials' && session && (
            <div id="credentials-panel" className="space-y-10 animate-slide-in-up">
                <div className="bg-white dark:bg-slate-900 rounded-2xl overflow-hidden border border-gray-100 dark:border-slate-800 shadow-sm">
                    <VerifiedTalentSection t={t} />
                </div>
                <div className="max-w-4xl mx-auto">
                    <Account session={session} onSetView={handleSetView} onSubscriptionChange={getProfile} navigateToPricing={navigateToPricing} t={t} />
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

  const renderContent = () => {
    if (view === 'auth') { return <Auth t={t} onClose={() => setView('home')} initialView={initialAuthView} mode={authMode} />; }
    if (view === 'account' && session) { return <Account key={session.user.id} session={session} onSetView={handleSetView} onSubscriptionChange={getProfile} navigateToPricing={navigateToPricing} t={t} />; }
    if (view === 'api_docs') { return <ApiDocsViewer onClose={() => setView('account')} />; }
    if (view === 'business') { return <BusinessPage t={t} session={session} profile={profile} onPostJobClick={() => handleSetView('auth', 'sign_up', 'business')} onSignInClick={() => handleSetView('auth', 'sign_in', 'business')} onSelectBusinessPlan={handleBusinessPlanSelection} onBack={() => handleSetView('home')} />; }
    if (view === 'agency' && session && profile) { return <AgencyHub session={session} profile={profile} t={t} />; }
    if (isLoading) { return <LoadingSpinner market={market} />; }
    if (analysisResult) { return <AnalysisDisplay t={t} result={analysisResult} onReset={handleReset} resumeText={resumeText} userPlan={userPlan} market={market} navigateToPricing={navigateToPricing} session={session} profile={profile} refreshProfile={getProfile} onApplyImprovements={handleApplyImprovements} activeTool={activeTool} setActiveTool={setActiveTool} />; }
    if (session && !showHomePageOverride) {
        if (!isProfileLoaded || !isLangLoaded) { return <div className="flex flex-col items-center justify-center space-y-4 my-24"><div className="w-16 h-16 border-4 border-blue-200 border-t-blue-700 rounded-full animate-spin"></div><p className="text-lg text-gray-600 dark:text-gray-400">{t('dashboard_loading')}</p></div>; }
        if (profile?.role === 'employer') {
            return <EmployerDashboard session={session} profile={profile} refreshProfile={getProfile} navigateToBusinessPricing={navigateToBusinessPricing} t={t} />;
        }
        return renderDashboard();
    }
    if (!isLangLoaded) { return <div className="flex flex-col items-center justify-center space-y-4 my-24"><div className="w-16 h-16 border-4 border-blue-200 border-t-blue-700 rounded-full animate-spin"></div><p className="text-lg text-gray-600">Loading...</p></div>; }
    return renderHomePage();
  };

  const isUserLoggedIn = session && !showHomePageOverride && view !== 'business' && profile?.role === 'candidate';

  return (
    <ToastProvider>
      <div className={`min-h-screen w-full font-sans bg-gray-50 text-gray-800 dark:bg-gray-950 dark:text-gray-200 ${isUserLoggedIn ? 'flex' : 'block'}`}>
        <style>{`.animate-fade-in { animation: fade-in 0.5s ease-out forwards; } .animate-slide-in-up { animation: slide-in-up 0.6s ease-out forwards; } .animate-pulse-mic { animation: pulse-mic 1.5s ease-in-out infinite; } .animate-pulse-glow { animation: pulse-glow 3s ease-in-out infinite; } .animate-aurora { animation: aurora 20s infinite linear; } .animate-holographic-text { animation: holographic-text 5s infinite linear; } .animate-crystal-glow { animation: crystal-glow 2.5s ease-in-out infinite; } .static-crystal-glow { filter: drop-shadow(0 0 5px rgba(251, 191, 36, 0.7)); } @keyframes fade-in { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } } @keyframes slide-in-up { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } } @keyframes pulse-mic { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.2); opacity: 0.7; } } @keyframes pulse-glow { 0%, 100% { opacity: 0.8; transform: scale(1); } 50% { opacity: 1; transform: scale(1.05); } } @keyframes aurora { from { background-position: 50% 50%, 50% 50%; } to { background-position: 350% 50%, 350% 50%; } } @keyframes holographic-text { 0%, 100% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } } @keyframes crystal-glow { 0%, 100% { filter: drop-shadow(0 0 4px rgba(251, 191, 36, 0.6)); } 50% { filter: drop-shadow(0 0 10px rgba(251, 191, 36, 0.9)); } }`}</style>
        {isRedirecting && <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[999] p-4 animate-fade-in"><div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl p-8 text-center flex flex-col items-center"><h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">Finalizing Your Upgrade!</h3><p className="mt-2 text-gray-600 dark:text-gray-300">To activate your new plan, we're opening our secure payment page.</p><div className="mt-6 w-12 h-12 border-4 border-blue-200 border-t-blue-700 rounded-full animate-spin"></div></div></div>}
        {isDevModeOpen && session && <DevModeModal session={session} profile={profile} onClose={() => setIsDevModeOpen(false)} onSetPlan={handleSetPlanForDev} />}
        <CreditModal isOpen={isCreditModalOpen} onClose={() => setIsCreditModalOpen(false)} onConfirm={() => { setIsCreditModalOpen(false); performAnalysis(); }} onNavigateToPricing={navigateToPricing} cost={analysisCost} currentCredits={credits} />
        
        {isUserLoggedIn ? (
            <>
                <Sidebar 
                    activeView={dashboardView}
                    onViewChange={(v) => { setDashboardView(v); setIsUpdatingResume(false); }}
                    profile={profile}
                    credits={credits}
                    theme={theme}
                    onToggleTheme={toggleTheme}
                    isAIMode={isAIMode}
                    onToggleAIMode={toggleAIMode}
                    activeTool={activeTool}
                    onToolSelect={setActiveTool}
                    onLogout={() => supabase.auth.signOut()}
                    t={t}
                />
                <div className="flex-1 flex flex-col h-screen overflow-hidden">
                    <header className="h-16 bg-white dark:bg-slate-900 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between px-8 shrink-0">
                        <ApiStatusBanner />
                        <div className="flex items-center gap-4 ml-auto text-gray-400">
                             <div className="text-xs font-bold uppercase tracking-widest">{dashboardView}</div>
                        </div>
                    </header>
                    <main className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-950 p-6 md:p-10">
                        <div className="max-w-6xl mx-auto">
                            {isUpdatingResume || !resumeText ? (
                                <div className="mt-4 animate-slide-in-up">
                                    <div className="text-center mb-10">
                                        <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">Resume Laboratory</h2>
                                        <p className="text-gray-600 dark:text-gray-400">{resumeText ? t('dashboard_update_prompt') : t('dashboard_new_user_prompt')}</p>
                                    </div>
                                    <div id="upload-section" ref={uploadSectionRef} className="scroll-mt-20">
                                        <UploadSection t={t} resumeText={resumeText} setResumeText={setResumeText} resumeImages={resumeImages} setResumeImages={setResumeImages} onInitiateAnalysis={handleInitiateAnalysis} isLoading={isLoading} error={error} setError={setError} market={market} setMarket={setMarket} />
                                    </div>
                                    {resumeText && (<div className="text-center mt-6"><button onClick={() => setIsUpdatingResume(false)} className="text-sm text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100 font-semibold bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 px-6 py-2 rounded-lg transition-colors">{t('dashboard_cancel_update')}</button></div>)}
                                </div>
                            ) : renderContent()}
                        </div>
                    </main>
                </div>
            </>
        ) : (
            <div className="flex flex-col min-h-screen">
                <ApiStatusBanner />
                <Header session={session} profile={profile} onSetView={handleSetView} navigateToPricing={navigateToPricing} t={t} changeLanguage={changeLanguage} currentLang={currentLang} theme={theme} toggleTheme={toggleTheme} view={view} credits={credits} />
                <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">{renderContent()}</main>
                <Footer onOpenDevMode={handleOpenDevMode} t={t} />
            </div>
        )}

        {isAIMode && <button onClick={() => setIsChatOpen(true)} className="fixed bottom-6 right-6 bg-gradient-to-br from-blue-600 to-indigo-700 text-white w-16 h-16 rounded-full shadow-lg hover:shadow-xl transform hover:scale-110 transition-all duration-300 z-40 flex items-center justify-center" aria-label="Open AI Career Coach"><svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M16.82 7.18002C16.82 5.58002 15.42 4.18002 13.82 4.18002C12.22 4.18002 10.82 5.58002 10.82 7.18002C10.82 8.78002 12.22 10.18 13.82 10.18C15.42 10.18 16.82 8.78002 16.82 7.18002Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M12 14.63H15.63" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M19.13 9.32002C20.94 11.52 20.73 14.6 18.6 16.59C16.47 18.58 13.06 18.74 11.02 16.94L7.52002 20.44C7.14002 20.82 6.51002 20.82 6.13002 20.44L4.21002 18.52C3.83002 18.14 3.83002 17.51 4.21002 17.13L7.71002 13.63C5.91002 11.59 5.75002 8.43002 7.74002 6.30002" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></button>}
        {isAIMode && isChatOpen && <CareerCoachBot isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} session={session} profile={profile} resumeText={resumeText} t={t} />}
      </div>
    </ToastProvider>
  );
};

const AppWrapper: React.FC = () => (
    <ApiStatusProvider>
        <CreditsProvider>
            <SettingsProvider>
                <AppContent />
            </SettingsProvider>
        </CreditsProvider>
    </ApiStatusProvider>
);

export default AppWrapper;
