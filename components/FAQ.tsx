import React, { useState } from 'react';

interface FAQProps {
    t: (key: string) => string;
}

const faqKeys = [
  'faq_1', 'faq_2', 'faq_3', 'faq_4', 'faq_5', 'faq_6', 'faq_7', 'faq_8',
  'faq_9', 'faq_10', 'faq_11', 'faq_12', 'faq_13'
];

interface FAQItemProps {
  item: { question: string; answer: string };
  index: number;
  activeIndex: number | null;
  setActiveIndex: (index: number | null) => void;
}

const FAQItem: React.FC<FAQItemProps> = ({ item, index, activeIndex, setActiveIndex }) => {
  const isOpen = index === activeIndex;

  const toggleFAQ = () => {
    setActiveIndex(isOpen ? null : index);
  };

  return (
    <div className="border border-gray-200/80 dark:border-slate-700/80 rounded-lg bg-white dark:bg-slate-800 shadow-sm transition-all duration-300 hover:shadow-md">
      <button
        onClick={toggleFAQ}
        className="w-full flex justify-between items-center text-left p-4 sm:p-5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 rounded-lg"
        aria-expanded={isOpen}
      >
        <h3 className="text-md sm:text-lg font-semibold text-gray-800 dark:text-gray-100">{item.question}</h3>
        <div className="flex-shrink-0 ml-4">
          <svg
            className={`w-6 h-6 text-gray-500 dark:text-gray-400 transition-transform duration-300 ${
              isOpen ? 'transform rotate-180 text-blue-600 dark:text-blue-400' : ''
            }`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>
      <div
        className={`overflow-hidden transition-all duration-500 ease-in-out ${
          isOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="pt-0 p-4 sm:p-5 sm:pt-0">
          <p className="text-gray-600 dark:text-gray-300 border-t border-gray-200 dark:border-slate-700 pt-4" dangerouslySetInnerHTML={{ __html: item.answer.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }}></p>
        </div>
      </div>
    </div>
  );
};


const FAQ: React.FC<FAQProps> = ({ t }) => {
  const [activeIndex, setActiveIndex] = useState<number | null>(0); // Open first question by default

  return (
    <section className="py-16 md:py-24 bg-gray-50 dark:bg-slate-900/50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-12 animate-slide-in-up">
          <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 dark:text-gray-100 tracking-tight">{t('faq_title')}</h2>
          <p className="mt-4 text-lg text-gray-600 dark:text-gray-400 max-w-3xl mx-auto">{t('faq_subtitle')}</p>
        </div>
        <div className="max-w-3xl mx-auto space-y-4">
          {faqKeys.map((key, index) => {
            const item = {
                question: t(`${key}_q`),
                answer: t(`${key}_a`),
            };
            return (
                <FAQItem
                key={index}
                item={item}
                index={index}
                activeIndex={activeIndex}
                setActiveIndex={setActiveIndex}
                />
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default FAQ;