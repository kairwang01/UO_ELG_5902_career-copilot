import React, { useState, useEffect } from 'react';

interface FooterProps {
    onOpenDevMode: () => void;
    t: (key: string) => string;
}

const Footer: React.FC<FooterProps> = ({ onOpenDevMode, t }) => {
    const [clickCount, setClickCount] = useState(0);

    const handleDevModeClick = () => {
        setClickCount(currentCount => {
            const newCount = currentCount + 1;
            if (newCount >= 7) {
                onOpenDevMode();
                return 0; // Reset count after triggering
            }
            return newCount; // Increment count
        });
    };

    // Reset count if user stops clicking
    useEffect(() => {
        if (clickCount > 0) {
            const timer = setTimeout(() => setClickCount(0), 2000); // Reset after 2 seconds of inactivity
            return () => clearTimeout(timer);
        }
    }, [clickCount]);

    const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, targetId: string) => {
        e.preventDefault();
        const element = document.getElementById(targetId);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth' });
        }
    };

  return (
    <footer className="bg-gray-900 text-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {/* Logo and description */}
          <div className="col-span-2 md:col-span-1">
            <a href="/" className="flex items-center mb-4" aria-label="Career CoPilot">
              <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="ml-2 text-xl font-bold">Career CoPilot</span>
            </a>
            <p className="text-sm text-gray-400">
              {t('footer_tagline')}
            </p>
          </div>

          {/* Links */}
          <div>
            <h6 className="font-bold text-gray-200 mb-2">{t('footer_toolkit')}</h6>
            <ul>
              <li className="mb-1"><a href="#features-section" onClick={(e) => handleNavClick(e, 'features-section')} className="text-gray-400 hover:text-white transition">{t('features_analysis_title')}</a></li>
              <li className="mb-1"><a href="#features-section" onClick={(e) => handleNavClick(e, 'features-section')} className="text-gray-400 hover:text-white transition">{t('features_opportunity_title')}</a></li>
              <li className="mb-1"><a href="#features-section" onClick={(e) => handleNavClick(e, 'features-section')} className="text-gray-400 hover:text-white transition">{t('features_interview_title')}</a></li>
              <li className="mb-1"><a href="#features-section" onClick={(e) => handleNavClick(e, 'features-section')} className="text-gray-400 hover:text-white transition">{t('features_career_title')}</a></li>
              <li className="mb-1"><a href="#pricing-section" onClick={(e) => handleNavClick(e, 'pricing-section')} className="text-gray-400 hover:text-white transition">{t('nav_pricing')}</a></li>
            </ul>
          </div>
          <div>
            <h6 className="font-bold text-gray-200 mb-2">{t('footer_company')}</h6>
            <ul>
              <li className="mb-1"><a href="#audience-section" onClick={(e) => handleNavClick(e, 'audience-section')} className="text-gray-400 hover:text-white transition">{t('footer_success_stories')}</a></li>
              <li className="mb-1"><a href="#faq-section" onClick={(e) => handleNavClick(e, 'faq-section')} className="text-gray-400 hover:text-white transition">{t('faq_title')}</a></li>
              <li className="mb-1"><a href="#" className="text-gray-400 hover:text-white transition">{t('footer_privacy')}</a></li>
              <li className="mb-1"><a href="#" className="text-gray-400 hover:text-white transition">{t('footer_terms')}</a></li>
            </ul>
          </div>
          <div>
            <h6 className="font-bold text-gray-200 mb-2">{t('footer_contact')}</h6>
            <ul>
              <li className="mb-1"><a href="mailto:support@careercopilot.ai" className="text-gray-400 hover:text-white transition">support@careercopilot.ai</a></li>
              <li className="mb-1"><span className="text-gray-400">{t('footer_location')}</span></li>
            </ul>
          </div>
        </div>
        <div className="mt-8 pt-8 border-t border-gray-800 text-center text-sm text-gray-500">
          <p>&copy; {new Date().getFullYear()} <span onClick={handleDevModeClick} className="cursor-pointer" title="Developer mode trigger">Career CoPilot</span>. {t('footer_copyright_end')}</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;