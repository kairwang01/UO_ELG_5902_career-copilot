export type ResumeSection = { title: string; content: string };

export type ResumeMarketRegion = 'north-america' | 'europe' | 'apac' | 'japan';

export type ResumeMarketStyle = {
  region: ResumeMarketRegion;
  label: string;
  pageSize: 'letter' | 'a4';
  density: 'compact' | 'balanced' | 'cv';
  documentWidthClass: string;
  documentClassName: string;
  headerClassName: string;
  nameClassName: string;
  contactsClassName: string;
  summaryClassName: string;
  sectionClassName: string;
  sectionHeadingClassName: string;
  leadLineClassName: string;
  bodyClassName: string;
  bulletListClassName: string;
  principles: string[];
};

const BASE_STYLE = {
  documentClassName: 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200 dark:bg-slate-950 dark:text-slate-50 dark:ring-slate-700',
  leadLineClassName: 'font-semibold text-slate-950 dark:text-white',
  bodyClassName: 'text-slate-700 dark:text-slate-300',
};

const RESUME_MARKET_STYLES: Record<ResumeMarketRegion, ResumeMarketStyle> = {
  'north-america': {
    region: 'north-america',
    label: 'North American ATS resume',
    pageSize: 'letter',
    density: 'compact',
    documentWidthClass: 'max-w-[816px]',
    documentClassName: BASE_STYLE.documentClassName,
    headerClassName: 'mb-4 border-b border-slate-900 pb-3 text-left dark:border-slate-600',
    nameClassName: 'text-[24px] font-semibold leading-tight tracking-normal text-slate-950 dark:text-white',
    contactsClassName: 'mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-[11.5px] leading-5 text-slate-600 dark:text-slate-300',
    summaryClassName: 'mt-2 max-w-none text-[12.5px] leading-[1.55] text-slate-700 dark:text-slate-300',
    sectionClassName: 'mb-3.5 break-inside-avoid',
    sectionHeadingClassName: 'mb-1.5 border-b border-slate-300 pb-0.5 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-950 dark:border-slate-700 dark:text-slate-100',
    leadLineClassName: BASE_STYLE.leadLineClassName,
    bodyClassName: BASE_STYLE.bodyClassName,
    bulletListClassName: 'my-1.5 list-disc space-y-0.5 pl-4 text-[12.5px] leading-[1.45] text-slate-700 dark:text-slate-300',
    principles: ['Single-column ATS-safe layout', 'No photo or protected personal details', 'Action-led bullets with metrics where supported'],
  },
  europe: {
    region: 'europe',
    label: 'European CV',
    pageSize: 'a4',
    density: 'cv',
    documentWidthClass: 'max-w-[794px]',
    documentClassName: BASE_STYLE.documentClassName,
    headerClassName: 'mb-5 border-b-2 border-slate-800 pb-4 text-left dark:border-slate-500',
    nameClassName: 'text-[23px] font-semibold leading-tight tracking-normal text-slate-950 dark:text-white',
    contactsClassName: 'mt-1.5 flex flex-wrap gap-x-2 gap-y-0.5 text-[11.5px] leading-5 text-slate-600 dark:text-slate-300',
    summaryClassName: 'mt-3 max-w-none text-[12.5px] leading-[1.6] text-slate-700 dark:text-slate-300',
    sectionClassName: 'mb-4 break-inside-avoid',
    sectionHeadingClassName: 'mb-1.5 border-b border-slate-300 pb-1 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-950 dark:border-slate-700 dark:text-slate-100',
    leadLineClassName: BASE_STYLE.leadLineClassName,
    bodyClassName: BASE_STYLE.bodyClassName,
    bulletListClassName: 'my-2 list-disc space-y-0.5 pl-4 text-[12.5px] leading-[1.5] text-slate-700 dark:text-slate-300',
    principles: ['A4 CV structure', 'Clear language and certification sections', 'Privacy-aware: no invented photo or personal-data fields'],
  },
  apac: {
    region: 'apac',
    label: 'APAC professional resume',
    pageSize: 'a4',
    density: 'balanced',
    documentWidthClass: 'max-w-[794px]',
    documentClassName: BASE_STYLE.documentClassName,
    headerClassName: 'mb-4 border-b border-slate-300 pb-3 text-left dark:border-slate-700',
    nameClassName: 'text-[23px] font-semibold leading-tight tracking-normal text-slate-950 dark:text-white',
    contactsClassName: 'mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-[11.5px] leading-5 text-slate-600 dark:text-slate-300',
    summaryClassName: 'mt-2.5 max-w-none text-[12.5px] leading-[1.55] text-slate-700 dark:text-slate-300',
    sectionClassName: 'mb-3.5 break-inside-avoid',
    sectionHeadingClassName: 'mb-1.5 border-b border-slate-300 pb-0.5 text-[11px] font-bold uppercase tracking-[0.13em] text-slate-950 dark:border-slate-700 dark:text-slate-100',
    leadLineClassName: BASE_STYLE.leadLineClassName,
    bodyClassName: BASE_STYLE.bodyClassName,
    bulletListClassName: 'my-1.5 list-disc space-y-0.5 pl-4 text-[12.5px] leading-[1.48] text-slate-700 dark:text-slate-300',
    principles: ['Achievement-led summary', 'Key skills visible early', 'Work-rights line when relevant and source-supported'],
  },
  japan: {
    region: 'japan',
    label: 'Japan career-history style',
    pageSize: 'a4',
    density: 'cv',
    documentWidthClass: 'max-w-[794px]',
    documentClassName: BASE_STYLE.documentClassName,
    headerClassName: 'mb-5 border-b border-slate-900 pb-4 text-left dark:border-slate-600',
    nameClassName: 'text-[22px] font-semibold leading-tight tracking-normal text-slate-950 dark:text-white',
    contactsClassName: 'mt-1.5 flex flex-wrap gap-x-2 gap-y-0.5 text-[11.5px] leading-5 text-slate-600 dark:text-slate-300',
    summaryClassName: 'mt-3 max-w-none text-[12.5px] leading-[1.65] text-slate-700 dark:text-slate-300',
    sectionClassName: 'mb-4 break-inside-avoid',
    sectionHeadingClassName: 'mb-1.5 border-b border-slate-400 pb-1 text-[11px] font-bold tracking-[0.08em] text-slate-950 dark:border-slate-700 dark:text-slate-100',
    leadLineClassName: BASE_STYLE.leadLineClassName,
    bodyClassName: BASE_STYLE.bodyClassName,
    bulletListClassName: 'my-2 list-disc space-y-0.5 pl-4 text-[12.5px] leading-[1.6] text-slate-700 dark:text-slate-300',
    principles: ['職務経歴書-style evidence summary', 'Conservative typography', 'Does not fake 履歴書 photo/personal fields'],
  },
};

export const getResumeMarketStyle = (market: string): ResumeMarketStyle => {
  const normalized = market.toLowerCase();
  if (/(canada|united states|usa|u\.s\.|north america)/.test(normalized)) return RESUME_MARKET_STYLES['north-america'];
  if (/(germany|france|united kingdom|\buk\b|europe|netherlands|spain|italy|ireland|switzerland)/.test(normalized)) return RESUME_MARKET_STYLES.europe;
  if (/(japan|日本)/.test(normalized)) return RESUME_MARKET_STYLES.japan;
  return RESUME_MARKET_STYLES.apac;
};

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
  'personal statement', 'professional summary', 'career profile',
  'experience', 'work experience', 'professional experience', 'employment history',
  'career history', 'work history',
  'education',
  'skills', 'key skills', 'technical skills', 'professional skills', 'core competencies',
  'projects',
  'certifications', 'licenses',
  'awards', 'honors', 'achievements',
  'publications', 'volunteer experience',
  'languages', 'interests', 'additional information',
];

const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// PDF text extraction often inserts a space between every CJK glyph and leaves
// runs of stray whitespace. Collapse those for the on-screen PREVIEW only (the
// stored resume_text is untouched) so a Chinese/Japanese resume reads cleanly.
const CJKISH = '\\u3000-\\u303f\\u3040-\\u30ff\\u3400-\\u4dbf\\u4e00-\\u9fff\\uf900-\\ufaff\\uff00-\\uffef';

export const cleanResumeDisplay = (text: string): string => {
  let cleaned = text
    .replace(/\r/g, '\n')
    .replace(/^#{1,3}\s+/gm, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    // Drop spaces sitting between two CJK / full-width characters (run twice
    // to catch the fully space-separated "字 字 字" case).
    .replace(new RegExp(`([${CJKISH}])[ \\t]+(?=[${CJKISH}])`, 'g'), '$1')
    .replace(new RegExp(`([${CJKISH}])[ \\t]+(?=[${CJKISH}])`, 'g'), '$1')
    .replace(/[ \t]{2,}/g, ' ')
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

  const headerRegex = new RegExp(`^\\s*[^a-zA-Z0-9]*(${EN_SECTION_KEYWORDS.map(escapeRegex).join('|')})[^a-zA-Z0-9]*\\s*$`, 'i');
  const cjkHeaderRegex = new RegExp(`^[\\s•·\\-—]*(${CJK_SECTION_LABELS.map(escapeRegex).join('|')})[\\s:：]*$`);

  let contentStarted = false;

  for (const line of lines) {
    const trimmedLine = line.trim();
    const isLikelyHeader = (headerRegex.test(trimmedLine) || cjkHeaderRegex.test(trimmedLine)) && trimmedLine.length < 50;

    if (isLikelyHeader) {
      contentStarted = true;
      if (currentSection.content.join('').trim()) {
        sections.push({ ...currentSection, content: currentSection.content.join('\n').trim() });
      }
      currentSection = { title: trimmedLine.replace(/[:]/g, '').trim(), content: [] };
    } else {
      if (!contentStarted && trimmedLine) {
        currentSection.title = 'Header';
      }
      currentSection.content.push(line);
    }
  }

  if (currentSection.content.join('').trim()) {
    sections.push({ ...currentSection, content: currentSection.content.join('\n').trim() });
  }

  if (sections.length === 0 && text.trim()) {
    return [{ title: 'Resume Content', content: text }];
  }

  return sections;
};
