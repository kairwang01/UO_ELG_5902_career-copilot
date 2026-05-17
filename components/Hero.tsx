import React from 'react';

interface HeroProps {
    onUploadClick: () => void;
    t: (key: string) => string;
}

const Hero: React.FC<HeroProps> = ({ onUploadClick, t }) => {
  return (
    <section className="pt-16 md:pt-24 pb-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-16">

          {/* Left Column: Content */}
          <div className="flex flex-col justify-center text-center md:text-left animate-slide-in-up">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tighter leading-tight text-gray-900 dark:text-gray-100">
              {t('hero_title_part1')} <span className="text-blue-700 dark:text-blue-500">{t('hero_title_part2')}</span> {t('hero_title_part3')} <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-700 dark:from-blue-500 dark:to-indigo-600">{t('hero_title_part4')}</span>
            </h1>
            <p className="mt-6 text-lg text-gray-600 dark:text-gray-400 max-w-lg mx-auto md:mx-0">
              {t('hero_subtitle')}
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center md:justify-start">
              <button onClick={onUploadClick} className="bg-blue-700 text-white font-bold py-3 px-8 rounded-lg shadow-lg hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-700 transition-all duration-300 ease-in-out transform hover:-translate-y-1">
                {t('hero_button_analyze')}
              </button>
              <button onClick={onUploadClick} className="bg-white dark:bg-slate-800 text-gray-800 dark:text-gray-200 font-bold py-3 px-8 rounded-lg shadow-md border border-gray-200 dark:border-slate-700 hover:bg-gray-100 dark:hover:bg-slate-700 hover:border-gray-300 dark:hover:border-slate-600 transition-all duration-300">
                {t('hero_button_learn_more')}
              </button>
            </div>
          </div>

          {/* Right Column: Image */}
          <div className="flex items-center justify-center animate-fade-in" style={{animationDelay: '0.3s'}}>
            <div className="relative w-full max-w-md">
                <div className="absolute -top-8 -left-8 w-48 h-48 bg-blue-200 dark:bg-blue-900/50 rounded-full opacity-30 blur-xl"></div>
                <div className="absolute -bottom-8 -right-8 w-48 h-48 bg-indigo-200 dark:bg-indigo-900/50 rounded-full opacity-30 blur-xl"></div>
                <div className="relative bg-white/60 dark:bg-slate-800/60 backdrop-blur-lg p-6 rounded-2xl shadow-2xl border border-gray-200/80 dark:border-slate-700/80">
                   <img src="https://images.unsplash.com/photo-1556761175-b413da4baf72?q=80&w=1974&auto=format&fit=crop" alt="Professionals in a meeting" className="rounded-xl w-full h-auto object-cover"/>
                   <div className="absolute -bottom-6 -left-6 bg-white/80 dark:bg-slate-800/80 backdrop-blur-md p-4 rounded-lg shadow-xl border border-gray-200/80 dark:border-slate-700/80">
                        <div className="flex justify-between items-center mb-1">
                            <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">Resume Score</span>
                            <span className="text-lg font-bold text-green-600 dark:text-green-500">94%</span>
                        </div>
                        <div className="w-40 bg-gray-200 dark:bg-slate-600 rounded-full h-2.5">
                            <div className="bg-gradient-to-r from-green-400 to-blue-500 h-2.5 rounded-full" style={{ width: '94%' }}></div>
                        </div>
                   </div>
                </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
};

export default Hero;
