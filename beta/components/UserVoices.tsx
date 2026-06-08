import React from 'react';
import { userVoices } from '../mock/userVoices';

interface UserVoicesProps {
  t: (key: string) => string;
}

export const UserVoices: React.FC<UserVoicesProps> = ({ t }) => (
  <section id="voices-section" className="py-12 sm:py-[var(--beta-section)]">
    <div className="max-w-6xl mx-auto px-4 sm:px-6">
      <h2 className="text-xl sm:text-2xl font-semibold mb-2">{t('beta_voices_title')}</h2>
      <p className="text-[var(--beta-text-muted)] mb-8 max-w-2xl">{t('beta_voices_subtitle')}</p>
      <div className="grid md:grid-cols-3 gap-4">
        {userVoices.map((voice) => (
          <article
            key={voice.id}
            className="border border-[var(--beta-border)] rounded-[var(--beta-radius)] overflow-hidden bg-[var(--beta-surface)]"
          >
            <img
              src={voice.imageSrc}
              alt={t(voice.imageAltKey)}
              className="w-full h-36 object-cover border-b border-[var(--beta-border)]"
              loading="lazy"
            />
            <div className="p-5">
              <p className="text-xs font-medium text-[var(--beta-action)]">{t(voice.roleKey)}</p>
              <blockquote className="mt-2 text-sm text-[var(--beta-text)] leading-relaxed">
                &ldquo;{t(voice.quoteKey)}&rdquo;
              </blockquote>
              <p className="mt-3 text-xs font-medium text-[var(--beta-text-muted)] border-t border-[var(--beta-border)] pt-3">
                {t(voice.highlightKey)}
              </p>
            </div>
          </article>
        ))}
      </div>
    </div>
  </section>
);
