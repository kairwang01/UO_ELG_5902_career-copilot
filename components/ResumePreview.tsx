import React from 'react';
import { cleanResumeDisplay, getResumeMarketStyle, parseResumeSections } from '../lib/resumePreview';
import type { ResumeMarketStyle } from '../lib/resumePreview';

interface ResumePreviewProps {
  resumeText: string;
  market: string;
  t: (key: string) => string;
  heightClassName?: string;
}

type ParsedHeader = { name: string; contacts: string[]; summary: string };

const CONTACT_REGEX = /(?:电话|手机|Phone|Mobile|Tel)\s*[:：]?\s*[+\d][+\d\s().-]{6,}|(?:Email|邮箱|E-mail)\s*[:：]?\s*[\w.+-]+@[\w.-]+\.\w+|(?:个人网站|网站|Website|Portfolio|LinkedIn|GitHub)\s*[:：]?\s*(?:https?:\/\/)?[^\s•|，,]+/gi;

const CONTACT_LABEL_REGEX = /^(?:电话|手机|Phone|Mobile|Tel|Email|邮箱|E-mail|个人网站|网站|Website|Portfolio|LinkedIn|GitHub)\s*[:：]?\s*/i;

const parseHeader = (content: string): ParsedHeader => {
    const compact = content.replace(/\s+/g, ' ').trim();
    if (!compact) return { name: '', contacts: [], summary: '' };

    const contactMatches = Array.from(compact.matchAll(CONTACT_REGEX));
    const firstContactIndex = contactMatches[0]?.index ?? -1;
    const firstLine = content.split('\n').map((line) => line.trim()).filter(Boolean)[0] ?? '';

    let name = '';
    if (firstContactIndex > 0) {
        name = compact.slice(0, firstContactIndex).replace(/[•|，,]+$/g, '').trim();
    } else if (firstLine.length <= 42 && !CONTACT_REGEX.test(firstLine)) {
        name = firstLine;
    }
    CONTACT_REGEX.lastIndex = 0;

    const contacts = contactMatches
        .map((match) => match[0]
            .replace(CONTACT_LABEL_REGEX, '')
            .replace(/\s+/g, ' ')
            .replace(/[•|，,]+$/g, '')
            .trim())
        .filter(Boolean);

    let summary = compact;
    if (name) summary = summary.replace(name, '').trim();
    for (const contact of contacts) {
        summary = summary.replace(contact, '').trim();
    }
    summary = summary
        .replace(/^[•|，,\s]+|[•|，,\s]+$/g, '')
        .replace(/\s*•\s*/g, ' • ')
        .trim();

    return { name, contacts, summary };
};

const splitParagraphs = (content: string): string[] =>
    content
        .split(/\n+/)
        .map((line) => line.trim())
        .flatMap((line) => {
            if (line.length <= 220) return [line];
            return line
                .split(/(?<=[。.!?])\s+/)
                .reduce<string[]>((acc, sentence) => {
                    const last = acc[acc.length - 1] ?? '';
                    if (!last || `${last} ${sentence}`.length > 220) acc.push(sentence);
                    else acc[acc.length - 1] = `${last} ${sentence}`.trim();
                    return acc;
                }, []);
        })
        .map((line) => line.trim())
        .filter(Boolean);

const splitBullets = (line: string): string[] => {
    const trimmed = line.trim();
    const withoutMarker = trimmed.replace(/^[•*\-–—]\s*/, '').trim();
    if (trimmed.includes('•')) {
        return trimmed
            .split(/\s*•\s*/)
            .map((item) => item.trim())
            .filter((item) => item.length > 0);
    }
    if (/^[•*\-–—]\s+/.test(trimmed)) return [withoutMarker];
    return [];
};

const renderResumeBody = (content: string, style: ResumeMarketStyle) => {
    const blocks: React.ReactNode[] = [];
    let bullets: string[] = [];
    const flushBullets = () => {
        if (!bullets.length) return;
        blocks.push(
            <ul key={`list-${blocks.length}`} className={style.bulletListClassName}>
                {bullets.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}
            </ul>,
        );
        bullets = [];
    };

    splitParagraphs(content).forEach((paragraph, index) => {
        const bulletItems = splitBullets(paragraph);
        if (bulletItems.length) {
            bullets.push(...bulletItems);
            return;
        }

        flushBullets();
        const isLeadLine = index === 0 && paragraph.length <= 120 && /(?:\d{4}|GPA|大学|University|College|Engineer|Manager|Developer|Intern|负责人|实习|项目)/i.test(paragraph);
        blocks.push(
            <p
                key={`p-${index}`}
                className={`${isLeadLine ? style.leadLineClassName : style.bodyClassName} mb-1 text-[12.5px] leading-[1.55]`}
            >
                {paragraph}
            </p>,
        );
    });

    flushBullets();
    return blocks;
};

const sectionTitle = (title: string): string => title === 'Resume Content' ? 'Resume' : title;

const ResumePreview: React.FC<ResumePreviewProps> = ({ resumeText, market, t, heightClassName = 'h-[420px] sm:h-[520px]' }) => {
  const style = getResumeMarketStyle(market);
  const cleaned = cleanResumeDisplay(resumeText);
  const sections = parseResumeSections(cleaned);
  const header = parseHeader(sections.find((s) => s.title === 'Header')?.content ?? '');
  const contentSections = sections.filter((section) => section.title !== 'Header');

  return (
    <div className={`${heightClassName} overflow-y-auto rounded-xl border border-slate-200 bg-slate-100 p-3 shadow-inner dark:border-slate-700 dark:bg-slate-950`}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 px-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
        <span>{style.label}</span>
        <span>{style.pageSize.toUpperCase()} · {style.density}</span>
      </div>
      <div className={`mx-auto min-h-full w-full ${style.documentWidthClass} ${style.documentClassName} px-7 py-7 sm:px-10 sm:py-9`}>
        {resumeText.trim() ? (
          <div className="font-sans text-slate-800 dark:text-slate-100">
            {(header.name || header.contacts.length > 0 || header.summary) && (
              <header className={style.headerClassName}>
                {header.name && (
                  <h1 className={style.nameClassName}>
                    {header.name}
                  </h1>
                )}
                {header.contacts.length > 0 && (
                  <div className={style.contactsClassName}>
                    {header.contacts.map((item, index) => (
                      <React.Fragment key={item}>
                        {index > 0 && <span aria-hidden="true">|</span>}
                        <span>{item}</span>
                      </React.Fragment>
                    ))}
                  </div>
                )}
                {header.summary && (
                  <p className={style.summaryClassName}>
                    {header.summary}
                  </p>
                )}
              </header>
            )}

            {contentSections.map((section, index) => (
              <section key={`${section.title}-${index}`} className={style.sectionClassName}>
                <h2 className={style.sectionHeadingClassName}>
                  {sectionTitle(section.title)}
                </h2>
                <div className="space-y-1">
                  {renderResumeBody(section.content, style)}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-center text-gray-400 dark:text-gray-500 font-sans">
            <p>{t('resume_preview_placeholder')}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ResumePreview;
