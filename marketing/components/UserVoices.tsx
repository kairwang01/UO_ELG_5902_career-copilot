import React from 'react';
import { successStories } from '../mock/successStories';

interface UserVoicesProps {
  t: (key: string) => string;
}

export const UserVoices: React.FC<UserVoicesProps> = ({ t }) => (
  <section id="audience-section" className="py-12 sm:py-[var(--site-section)]">
    <div className="max-w-6xl mx-auto px-4 sm:px-6">
      <div className="text-center mb-10">
        <h2 className="text-xl sm:text-2xl font-semibold">{t('audience_title')}</h2>
        <p className="mt-3 text-[var(--site-text-muted)] max-w-3xl mx-auto">{t('audience_subtitle')}</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        {successStories.map((story) => (
          <article
            key={story.id}
            className="border border-[var(--site-border)] rounded-[var(--site-radius)] overflow-hidden bg-[var(--site-surface)] flex flex-col sm:flex-row"
          >
            <img
              src={story.imageSrc}
              alt={story.name}
              className="w-full sm:w-36 md:w-40 h-48 sm:h-auto shrink-0 object-cover object-center"
              loading="lazy"
            />
            <div className="p-5 flex flex-col justify-between min-w-0">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--site-action)]">
                  {t(story.roleKey)}
                </p>
                <blockquote className="mt-2 text-sm text-[var(--site-text)] leading-relaxed border-l-2 border-[var(--site-action)]/30 pl-3 italic">
                  &ldquo;{t(story.quoteKey)}&rdquo;
                </blockquote>
                <p className="mt-3 text-sm font-semibold text-[var(--site-text)] text-right">
                  — {story.name}
                </p>
              </div>
              <div className="mt-4 pt-4 border-t border-[var(--site-border)]">
                <h4 className="text-xs font-semibold text-[var(--site-text-muted)] mb-2">
                  {t('audience_top_tools')}
                </h4>
                <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-[var(--site-text-muted)]">
                  {story.toolKeys.map((toolKey) => (
                    <li key={toolKey}>{t(toolKey)}</li>
                  ))}
                </ul>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  </section>
);
