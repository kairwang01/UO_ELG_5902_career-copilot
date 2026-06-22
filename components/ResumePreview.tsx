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

const CONTACT_REGEX = /(?:电话|手机|Phone|Mobile|Tel|電話番号|電話)\s*[:：]?\s*[+\d][+\d\s().-]{6,}|(?:Email|邮箱|E-mail|メールアドレス|メール)\s*[:：]?\s*[\w.+-]+@[\w.-]+\.\w+|(?:个人网站|网站|Website|Portfolio|LinkedIn|GitHub|ウェブサイト|Webサイト)\s*[:：]?\s*(?:https?:\/\/)?[^\s•|，,]+/gi;

const CONTACT_LABEL_REGEX = /^(?:电话|手机|Phone|Mobile|Tel|電話番号|電話|Email|邮箱|E-mail|メールアドレス|メール|个人网站|网站|Website|Portfolio|LinkedIn|GitHub|ウェブサイト|Webサイト)\s*[:：]?\s*/i;
const NAME_LABEL_REGEX = /^(?:氏名|名前|Name|Full Name|姓名)\s*[:：]\s*/i;
const LOCATION_LABEL_REGEX = /^(?:所在地|住所|Location|Address)\s*[:：]\s*/i;
const PHOTO_PLACEHOLDER_REGEX = /^(?:写真|Photo)\s*[:：]?\s*(?:\[.*?\]|（.*?）|\(.*?\)|ここに.*?(?:貼付|貼る)|証明写真.*?)/i;

const parseHeader = (content: string): ParsedHeader => {
    const lines = content.split('\n').map((line) => line.trim()).filter(Boolean);
    const compact = content.replace(/\s+/g, ' ').trim();
    if (!compact) return { name: '', contacts: [], summary: '' };

    const contactSet = new Set<string>();
    const consumedLines = new Set<number>();
    lines.forEach((line, index) => {
        if (PHOTO_PLACEHOLDER_REGEX.test(line)) {
            consumedLines.add(index);
            return;
        }

        CONTACT_REGEX.lastIndex = 0;
        const matches = Array.from(line.matchAll(CONTACT_REGEX));
        if (matches.length) {
            matches
                .map((match) => match[0].replace(CONTACT_LABEL_REGEX, '').replace(/\s+/g, ' ').replace(/[•|｜，,]+$/g, '').trim())
                .filter(Boolean)
                .forEach((match) => contactSet.add(match));
            consumedLines.add(index);
            return;
        }

        if (LOCATION_LABEL_REGEX.test(line)) {
            const location = line.replace(LOCATION_LABEL_REGEX, '').replace(/\s+/g, ' ').trim();
            if (location) contactSet.add(location);
            consumedLines.add(index);
        }
    });

    let name = '';
    const labelledNameIndex = lines.findIndex((line) => NAME_LABEL_REGEX.test(line));
    if (labelledNameIndex >= 0) {
        name = lines[labelledNameIndex].replace(NAME_LABEL_REGEX, '').replace(/[•|｜，,]+$/g, '').trim();
        consumedLines.add(labelledNameIndex);
    }

    const contactMatches = Array.from(compact.matchAll(CONTACT_REGEX));
    const firstContactIndex = contactMatches[0]?.index ?? -1;
    const firstLine = lines.find((line, index) => !consumedLines.has(index)) ?? '';

    if (!name && firstContactIndex > 0) {
        name = compact.slice(0, firstContactIndex).replace(/[•|，,]+$/g, '').trim();
    } else if (!name && firstLine.length <= 42) {
        CONTACT_REGEX.lastIndex = 0;
        if (!CONTACT_REGEX.test(firstLine) && !LOCATION_LABEL_REGEX.test(firstLine) && !PHOTO_PLACEHOLDER_REGEX.test(firstLine)) {
            name = firstLine.replace(NAME_LABEL_REGEX, '').trim();
            const firstLineIndex = lines.indexOf(firstLine);
            if (firstLineIndex >= 0) consumedLines.add(firstLineIndex);
        }
    }
    CONTACT_REGEX.lastIndex = 0;

    contactMatches
        .map((match) => match[0]
            .replace(CONTACT_LABEL_REGEX, '')
            .replace(/\s+/g, ' ')
            .replace(/[•|｜，,]+$/g, '')
            .trim())
        .filter(Boolean)
        .forEach((contact) => contactSet.add(contact));

    const contacts = Array.from(contactSet);
    const summary = lines
        .filter((line, index) => !consumedLines.has(index))
        .join(' ')
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
    <div
      className={`${heightClassName} overflow-y-auto rounded-xl border border-slate-200 bg-slate-100 p-3 shadow-inner dark:border-slate-700 dark:bg-slate-950`}
      data-qa="resume-preview-shell"
      data-qa-resume-region={style.region}
      data-qa-resume-page-size={style.pageSize}
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 px-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
        <span data-qa="resume-preview-style-label">{style.label}</span>
        <span data-qa="resume-preview-style-meta">{style.pageSize.toUpperCase()} · {style.density}</span>
      </div>
      <div
        className={`mx-auto min-h-full w-full ${style.documentWidthClass} ${style.documentClassName} px-7 py-7 sm:px-10 sm:py-9`}
        role="document"
        data-qa="resume-preview-document"
        aria-label={header.name ? `${header.name} resume preview` : t('resume_preview_placeholder')}
      >
        {resumeText.trim() ? (
          <div className="font-sans text-slate-800 dark:text-slate-100">
            {(header.name || header.contacts.length > 0 || header.summary) && (
              <header className={style.headerClassName}>
                {header.name && (
                  <div className={style.nameClassName}>
                    {header.name}
                  </div>
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
              <section
                key={`${section.title}-${index}`}
                className={style.sectionClassName}
                data-qa="resume-preview-section"
                data-qa-section-title={sectionTitle(section.title)}
              >
                <div className={style.sectionHeadingClassName} data-qa="resume-preview-section-title">
                  {sectionTitle(section.title)}
                </div>
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
