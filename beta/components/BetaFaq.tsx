import React, { useState } from 'react';

const FAQ_KEYS = ['faq_1', 'faq_2', 'faq_3', 'faq_4', 'faq_5'] as const;

interface BetaFaqProps {
  t: (key: string) => string;
}

export const BetaFaq: React.FC<BetaFaqProps> = ({ t }) => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="faq-section" className="py-12 sm:py-[var(--beta-section)] bg-[var(--beta-surface-muted)]">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        <h2 className="text-xl sm:text-2xl font-semibold mb-2">{t('faq_title')}</h2>
        <p className="text-[var(--beta-text-muted)] mb-8">{t('faq_subtitle')}</p>
        <div className="space-y-2">
          {FAQ_KEYS.map((key, index) => {
            const isOpen = openIndex === index;
            return (
              <div
                key={key}
                className="border border-[var(--beta-border)] rounded-[var(--beta-radius)] bg-[var(--beta-surface)]"
              >
                <button
                  type="button"
                  onClick={() => setOpenIndex(isOpen ? null : index)}
                  className="w-full flex justify-between items-start gap-4 text-left p-4 sm:p-5 focus:outline-none focus:ring-2 focus:ring-[var(--beta-action)]/40 rounded-[var(--beta-radius)]"
                  aria-expanded={isOpen}
                >
                  <span className="font-medium text-[var(--beta-text)]">{t(`${key}_q`)}</span>
                  <span className="text-[var(--beta-text-muted)] shrink-0" aria-hidden="true">
                    {isOpen ? '−' : '+'}
                  </span>
                </button>
                {isOpen && (
                  <div className="px-4 sm:px-5 pb-4 sm:pb-5 text-sm text-[var(--beta-text-muted)] leading-relaxed">
                    {t(`${key}_a`)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
