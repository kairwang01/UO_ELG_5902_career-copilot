import React from 'react';

interface ResumePreviewProps {
  resumeText: string;
  market: string;
  t: (key: string) => string;
}

type ResumeSection = { title: string; content: string };
type ParsedHeader = { name: string; contacts: string[]; summary: string };

const CJK_SECTION_LABELS = [
  '综合能力概述', '个人概述', '个人简介', '自我评价', '职业概述',
  '教育背景', '教育经历',
  '工作经历', '工作经验', '职业经历', '实习经历',
  '项目经历', '项目经验',
  '专业技能', '技术能力', '核心技能', '技能特长',
  '证书', '资格证书', '荣誉奖项', '获奖经历', '语言能力',
];

const EN_SECTION_KEYWORDS = [
  'summary', 'objective', 'profile',
  'experience', 'work experience', 'professional experience', 'employment history',
  'education',
  'skills', 'technical skills', 'professional skills', 'core competencies',
  'projects',
  'certifications', 'licenses',
  'awards', 'honors', 'achievements',
  'publications', 'volunteer experience',
];

const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// PDF text extraction often inserts a space between every CJK glyph and leaves
// runs of stray whitespace. Collapse those for the on-screen PREVIEW only (the
// stored resume_text is untouched) so a Chinese/Japanese resume reads cleanly.
const CJKISH = '\\u3000-\\u303f\\u3040-\\u30ff\\u3400-\\u4dbf\\u4e00-\\u9fff\\uf900-\\ufaff\\uff00-\\uffef';
export const cleanResumeDisplay = (text: string): string => {
    let cleaned = text
        .replace(/\r/g, '\n')
        // drop spaces sitting between two CJK / full-width characters (run twice
        // to catch the fully space-separated "字 字 字" case)
        .replace(new RegExp(`([${CJKISH}])[ \\t]+(?=[${CJKISH}])`, 'g'), '$1')
        .replace(new RegExp(`([${CJKISH}])[ \\t]+(?=[${CJKISH}])`, 'g'), '$1')
        .replace(/[ \t]{2,}/g, ' ') // collapse long space runs
        .replace(/[●▪◦]/g, '•');

    // OCR/PDF extraction often removes section line breaks, producing strings
    // like "教育背景渥太华大学..." Insert preview-only line breaks so the parser
    // can recover a resume structure without mutating the stored resume text.
    for (const label of CJK_SECTION_LABELS) {
        cleaned = cleaned.replace(
            new RegExp(`\\s*(${escapeRegex(label)})(?:\\s*[:：])?\\s*`, 'g'),
            '\n$1\n',
        );
    }

    return cleaned
        .replace(/\n{3,}/g, '\n\n')
        .trim();
};

// A heuristic-based parser to identify sections in a plain-text resume.
export const parseResumeSections = (text: string): ResumeSection[] => {
    if (!text || !text.trim()) return [];

    const lines = text.split('\n');
    const sections: ResumeSection[] = [];
    let currentSection: { title: string; content: string[] } = { title: 'Header', content: [] };

    // Regex to find a line that is probably a section header. Case-insensitive.
    const headerRegex = new RegExp(`^\\s*[^a-zA-Z0-9]*(${EN_SECTION_KEYWORDS.map(escapeRegex).join('|')})[^a-zA-Z0-9]*\\s*$`, 'i');
    // Chinese resume section headers (standalone short lines).
    const cjkHeaderRegex = new RegExp(`^[\\s•·\\-—]*(${CJK_SECTION_LABELS.map(escapeRegex).join('|')})[\\s:：]*$`);

    let contentStarted = false;

    for (const line of lines) {
        const trimmedLine = line.trim();
        // A line is likely a header if it matches keywords and is not too long.
        const isLikelyHeader = (headerRegex.test(trimmedLine) || cjkHeaderRegex.test(trimmedLine)) && trimmedLine.length < 50;

        if (isLikelyHeader) {
            contentStarted = true;
            // Push the previous section if it has content
            if (currentSection.content.join('').trim()) {
                sections.push({ ...currentSection, content: currentSection.content.join('\n').trim() });
            }
            // Start a new section
            currentSection = { title: trimmedLine.replace(/[:]/g, '').trim(), content: [] };
        } else {
            // Lines before the first section header are part of the main header.
            if (!contentStarted && trimmedLine) {
                currentSection.title = 'Header';
            }
            currentSection.content.push(line);
        }
    }
    
    // Push the last remaining section
    if (currentSection.content.join('').trim()) {
        sections.push({ ...currentSection, content: currentSection.content.join('\n').trim() });
    }
    
    // Fallback for resumes that couldn't be parsed into sections.
    if (sections.length === 0 && text.trim()) {
        return [{ title: 'Resume Content', content: text }];
    }

    return sections;
};

const CONTACT_REGEX = /(?:电话|手机|Phone|Mobile|Tel)\s*[:：]?\s*[+\d][+\d\s().-]{6,}|(?:Email|邮箱|E-mail)\s*[:：]?\s*[\w.+-]+@[\w.-]+\.\w+|(?:个人网站|网站|Website|Portfolio|LinkedIn|GitHub)\s*[:：]?\s*(?:https?:\/\/)?[^\s•|，,]+/gi;

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
        .map((match) => match[0].replace(/\s+/g, ' ').replace(/[•|，,]+$/g, '').trim())
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

const renderResumeBody = (content: string) => {
    const blocks: React.ReactNode[] = [];
    let bullets: string[] = [];
    const flushBullets = () => {
        if (!bullets.length) return;
        blocks.push(
            <ul key={`list-${blocks.length}`} className="my-2 list-disc space-y-1 pl-5 text-[13px] leading-[1.55] text-slate-700 dark:text-slate-300">
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
                className={`${isLeadLine ? 'font-semibold text-slate-900 dark:text-slate-100' : 'text-slate-700 dark:text-slate-300'} mb-1.5 text-[13px] leading-[1.6]`}
            >
                {paragraph}
            </p>,
        );
    });

    flushBullets();
    return blocks;
};

const sectionTitle = (title: string): string => title === 'Resume Content' ? 'Resume' : title;

const ResumePreview: React.FC<ResumePreviewProps> = ({ resumeText, t }) => {
  const cleaned = cleanResumeDisplay(resumeText);
  const sections = parseResumeSections(cleaned);
  const header = parseHeader(sections.find((s) => s.title === 'Header')?.content ?? '');
  const contentSections = sections.filter((section) => section.title !== 'Header');

  return (
    <div className="h-[420px] overflow-y-auto rounded-xl border border-slate-200 bg-slate-100 p-3 shadow-inner dark:border-slate-700 dark:bg-slate-950 sm:h-[520px]">
      <div className="mx-auto min-h-full w-full max-w-[720px] bg-white px-6 py-7 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700 sm:px-9 sm:py-8">
        {resumeText.trim() ? (
          <div className="font-sans text-slate-800 dark:text-slate-100">
            {(header.name || header.contacts.length > 0 || header.summary) && (
              <header className="mb-5 border-b border-slate-300 pb-4 text-center dark:border-slate-700">
                {header.name && (
                  <h1 className="text-xl font-bold tracking-tight text-slate-950 dark:text-white sm:text-2xl">
                    {header.name}
                  </h1>
                )}
                {header.contacts.length > 0 && (
                  <div className="mt-2 flex flex-wrap justify-center gap-x-3 gap-y-1 text-[12px] leading-5 text-slate-600 dark:text-slate-300">
                    {header.contacts.map((item) => <span key={item}>{item}</span>)}
                  </div>
                )}
                {header.summary && (
                  <p className="mx-auto mt-3 max-w-2xl text-left text-[13px] leading-[1.65] text-slate-700 dark:text-slate-300">
                    {header.summary}
                  </p>
                )}
              </header>
            )}

            {contentSections.map((section, index) => (
              <section key={`${section.title}-${index}`} className="mb-4 break-inside-avoid">
                <h2 className="mb-2 border-b border-slate-300 pb-1 text-[12px] font-bold uppercase tracking-[0.16em] text-slate-900 dark:border-slate-700 dark:text-slate-100">
                  {sectionTitle(section.title)}
                </h2>
                <div className="space-y-1">
                  {renderResumeBody(section.content)}
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
