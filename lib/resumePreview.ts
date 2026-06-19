export type ResumeSection = { title: string; content: string };

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
