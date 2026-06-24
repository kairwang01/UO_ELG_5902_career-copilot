export type ResumeSection = { title: string; content: string };

export type ResumeMarketRegion = 'north-america' | 'europe' | 'apac' | 'japan' | 'vietnam';

export type ResumeMarketStyle = {
  region: ResumeMarketRegion;
  labelKey: string;
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
  principleKeys: string[];
};

const BASE_STYLE = {
  documentClassName: 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200 dark:bg-slate-950 dark:text-slate-50 dark:ring-slate-700',
  leadLineClassName: 'font-semibold text-slate-950 dark:text-white',
  bodyClassName: 'text-slate-700 dark:text-slate-300',
};

const RESUME_MARKET_STYLES: Record<ResumeMarketRegion, ResumeMarketStyle> = {
  'north-america': {
    region: 'north-america',
    labelKey: 'resume_market_label_north_america',
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
    principleKeys: ['resume_market_principle_north_america_1', 'resume_market_principle_north_america_2', 'resume_market_principle_north_america_3'],
  },
  europe: {
    region: 'europe',
    labelKey: 'resume_market_label_europe',
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
    principleKeys: ['resume_market_principle_europe_1', 'resume_market_principle_europe_2', 'resume_market_principle_europe_3'],
  },
  apac: {
    region: 'apac',
    labelKey: 'resume_market_label_apac',
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
    principleKeys: ['resume_market_principle_apac_1', 'resume_market_principle_apac_2', 'resume_market_principle_apac_3'],
  },
  japan: {
    region: 'japan',
    labelKey: 'resume_market_label_japan',
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
    principleKeys: ['resume_market_principle_japan_1', 'resume_market_principle_japan_2', 'resume_market_principle_japan_3'],
  },
  vietnam: {
    region: 'vietnam',
    labelKey: 'resume_market_label_vietnam',
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
    principleKeys: ['resume_market_principle_vietnam_1', 'resume_market_principle_vietnam_2', 'resume_market_principle_vietnam_3'],
  },
};

export const getResumeMarketStyle = (market: string): ResumeMarketStyle => {
  const normalized = market.toLowerCase();
  if (/(canada|united states|usa|u\.s\.|north america)/.test(normalized)) return RESUME_MARKET_STYLES['north-america'];
  if (/(germany|france|united kingdom|\buk\b|europe|netherlands|spain|italy|ireland|switzerland)/.test(normalized)) return RESUME_MARKET_STYLES.europe;
  if (/(vietnam|viet nam|việt nam)/.test(normalized)) return RESUME_MARKET_STYLES.vietnam;
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
  '職務要約', '職務経歴', '職歴', '学歴', 'スキル', '技術スキル', '保有スキル',
  '資格', '語学', '自己PR', '志望動機', 'プロジェクト経験',
  'Profil', 'Expérience professionnelle', 'Formation', 'Compétences', 'Certifications', 'Langues',
  'Profil professionnel', 'Berufserfahrung', 'Ausbildung', 'Studium', 'Kenntnisse', 'Fähigkeiten',
  'Zertifikate', 'Sprachen',
];

const INLINE_FIELD_LABELS = [
  '氏名', '名前', '電話番号', '電話', 'メールアドレス', 'メール', '所在地', '住所',
  'ウェブサイト', 'Webサイト', '写真',
  'Name', 'Full Name', 'Phone', 'Mobile', 'Tel', 'Email', 'E-mail', 'Location', 'Address',
  'Website', 'Portfolio', 'LinkedIn', 'GitHub',
  '姓名', '电话', '手机', '邮箱', '个人网站', '网站',
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
    .replace(/(?:^|\n)\s*(?:写真|Photo|顔写真)\s*[:：]?\s*(?:[[［（(〔].*?[\]］）)〕]|ここに.*?(?:貼付|貼る)|証明写真.*?)/gi, '\n')
    .replace(/[|｜]{2,}/g, '\n')
    .replace(/\s*[|｜]\s*-{2,}\s*[|｜]?\s*/g, '\n')
    // Drop spaces sitting between two CJK / full-width characters (run twice
    // to catch the fully space-separated "字 字 字" case).
    .replace(new RegExp(`([${CJKISH}])[ \\t]+(?=[${CJKISH}])`, 'g'), '$1')
    .replace(new RegExp(`([${CJKISH}])[ \\t]+(?=[${CJKISH}])`, 'g'), '$1')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[●▪◦■◆◇]/g, '•');

  const fieldLabelsByLength = [...INLINE_FIELD_LABELS].sort((a, b) => b.length - a.length);
  for (const label of fieldLabelsByLength) {
    cleaned = cleaned.replace(
      new RegExp(`\\s+(${escapeRegex(label)})\\s*[:：]`, 'gi'),
      '\n$1: ',
    );
  }

  for (const label of fieldLabelsByLength) {
    cleaned = cleaned.replace(
      new RegExp(`([^\\n])(${escapeRegex(label)})\\s*[:：]`, 'gi'),
      '$1\n$2: ',
    );
  }

  cleaned = cleaned.replace(/(?:^|\n)\s*(?:写真|Photo|顔写真)\s*[:：]?\s*(?:[[［（(〔].*?[\]］）)〕]|ここに.*?(?:貼付|貼る)|証明写真.*?)/gi, '\n');

  // OCR/PDF extraction often removes section line breaks, producing strings
  // like "教育背景渥太华大学..." Insert preview-only line breaks so the parser
  // can recover a resume structure without mutating the stored resume text.
  for (const label of CJK_SECTION_LABELS) {
    cleaned = cleaned.replace(
      new RegExp(`\\s*(${escapeRegex(label)})(?:\\s*[:：])?\\s*`, 'g'),
      '\n$1\n',
    );
  }

  cleaned = cleaned
    .split('\n')
    .flatMap((line) => {
      const pipeParts = line.split(/\s*[|｜]\s*/).map((part) => part.trim()).filter(Boolean);
      return pipeParts.length >= 4 ? pipeParts : [line];
    })
    .filter((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed === '•') return false;
      return !/^(年月|学校名|専攻|成績|期間|組織名|内容|Year|Date|School|Major|Grade)$/i.test(trimmed);
    })
    .join('\n');

  return cleaned
    .replace(/:\s{2,}/g, ': ')
    .replace(/\s+•\s*$/gm, '')
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

export type ResumeValidationStatus = 'ok' | 'warn' | 'needs_regen';

export interface ResumeValidation {
  status: ResumeValidationStatus;
  issues: string[];
}

// Post-generation gate for the resume formatter. The prompt is a *request* not to emit
// tables / photo placeholders / fabricated personal fields; this is the *enforcement*.
// Run on the (already display-cleaned) output: if it is still a garbled blob — no
// parseable sections, a surviving photo placeholder, or a multi-row pipe table — return
// `needs_regen` so the UI offers a clean re-run instead of presenting broken output as
// final. Source-plausible personal fields downgrade to a non-blocking `warn`.
export const assessFormattedResume = (text: string): ResumeValidation => {
  const cleaned = cleanResumeDisplay(text || '');
  if (!cleaned.trim()) return { status: 'needs_regen', issues: ['empty'] };

  const issues: string[] = [];
  const lines = cleaned.split('\n');

  // Photo / image placeholder survived cleaning.
  if (/写真|証明写真|顔写真|\[\s*(?:photo|写真|画像|image)\s*\]/i.test(cleaned)) issues.push('photo_placeholder');

  // A real (multi-row) pipe table survived. A single "React | Node | SQL" skills line
  // is NOT a table (one row), and cleaning already splits ≥4-cell rows — so require
  // 2+ consecutive rows that each carry ≥2 separators.
  let consec = 0;
  for (const line of lines) {
    if ((line.match(/[|｜]/g) || []).length >= 2) { consec += 1; if (consec >= 2) { issues.push('pipe_table'); break; } }
    else consec = 0;
  }

  // Structure: did it parse into real sections, or is it one undifferentiated blob?
  const sections = parseResumeSections(cleaned);
  const contentSections = sections.filter((s) => s.title !== 'Header' && s.title !== 'Resume Content');
  const topBlock = sections.find((s) => s.title === 'Header' || s.title === 'Resume Content');
  if (contentSections.length === 0 && cleaned.trim().length > 400) issues.push('no_sections');
  else if ((topBlock?.content?.length ?? 0) > 900) issues.push('overlong_header');

  // Protected / sensitive fields the formatter must not fabricate (soft — the source
  // resume may legitimately carry them, so warn rather than block).
  if (/(生年月日|date of birth|\bd\.?o\.?b\.?\b|国籍|nationality|婚姻|marital status|性別\s*[:：]|gender\s*[:：]|ビザ|visa status)/i.test(cleaned)) {
    issues.push('sensitive_fields');
  }

  const blocking = issues.filter((i) => i !== 'sensitive_fields');
  if (blocking.length > 0) return { status: 'needs_regen', issues };
  if (issues.length > 0) return { status: 'warn', issues };
  return { status: 'ok', issues: [] };
};
