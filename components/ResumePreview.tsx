import React from 'react';
import { renderFormattedText } from './tools/ToolUtils';

interface ResumePreviewProps {
  resumeText: string;
  market: string;
  t: (key: string) => string;
}

// PDF text extraction often inserts a space between every CJK glyph and leaves
// runs of stray whitespace. Collapse those for the on-screen PREVIEW only (the
// stored resume_text is untouched) so a Chinese/Japanese resume reads cleanly.
const CJKISH = '\\u3000-\\u303f\\u3040-\\u30ff\\u3400-\\u4dbf\\u4e00-\\u9fff\\uf900-\\ufaff\\uff00-\\uffef';
const cleanResumeDisplay = (text: string): string =>
    text
        // drop spaces sitting between two CJK / full-width characters (run twice
        // to catch the fully space-separated "字 字 字" case)
        .replace(new RegExp(`([${CJKISH}])[ \\t]+(?=[${CJKISH}])`, 'g'), '$1')
        .replace(new RegExp(`([${CJKISH}])[ \\t]+(?=[${CJKISH}])`, 'g'), '$1')
        .replace(/[ \t]{2,}/g, ' ') // collapse long space runs
        .replace(/\n{3,}/g, '\n\n'); // collapse big vertical gaps

// A heuristic-based parser to identify sections in a plain-text resume.
const parseResumeSections = (text: string): { title: string; content: string }[] => {
    if (!text || !text.trim()) return [];

    const lines = text.split('\n');
    const sections: { title: string; content: string }[] = [];
    let currentSection: { title: string; content: string[] } = { title: 'Header', content: [] };

    const sectionKeywords = [
        'summary', 'objective', 'profile',
        'experience', 'work experience', 'professional experience', 'employment history',
        'education',
        'skills', 'technical skills', 'professional skills', 'core competencies',
        'projects',
        'certifications', 'licenses',
        'awards', 'honors', 'achievements',
        'publications', 'volunteer experience'
    ];
    // Regex to find a line that is probably a section header. Case-insensitive.
    const headerRegex = new RegExp(`^\\s*[^a-zA-Z0-9]*(${sectionKeywords.join('|')})[^a-zA-Z0-9]*\\s*$`, 'i');
    // Chinese resume section headers (standalone short lines).
    const cjkHeaderRegex = /^[\s•·\-—]*(个人概述|综合能力概述|能力概述|自我评价|个人简介|个人信息|教育背景|教育经历|教育|工作经历|工作经验|职业经历|实习经历|项目经历|项目经验|项目|专业技能|技术能力|技能特长|核心技能|个人技能|技能|证书|资格证书|荣誉奖项|获奖经历|所获奖项|语言能力|兴趣爱好)[\s:：]*$/;

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

const ResumePreview: React.FC<ResumePreviewProps> = ({ resumeText, t }) => {
  const cleaned = cleanResumeDisplay(resumeText);
  const sections = parseResumeSections(cleaned);
  // Only center a genuine short contact header (name + contact). A long block —
  // e.g. a CJK resume where no sections were detected, so everything lands in
  // "Header" — must stay left-aligned, or it renders as a centered wall of text.
  const headerCentered = sections.length > 1 && (sections.find((s) => s.title === 'Header')?.content.length ?? 0) <= 200;

  return (
    <div className="bg-gray-100 dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded-lg h-[380px] overflow-y-auto p-4 font-serif">
      <div className="bg-white dark:bg-slate-800 shadow-lg p-6 min-h-full">
        {resumeText.trim() ? (
          <div className="text-gray-800 dark:text-gray-300">
            {sections.map((section, index) => {
              const isHeader = section.title === 'Header';
              const isGenericContent = section.title === 'Resume Content';

              if (isGenericContent) {
                  return <div key={index} className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">{renderFormattedText(section.content)}</div>;
              }
              
              if (isHeader) {
                  return (
                      <div key={index} className={`mb-6 pb-4 border-b dark:border-slate-600 ${headerCentered ? 'text-center' : ''}`}>
                          <div className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-wrap break-words">
                              {renderFormattedText(section.content)}
                          </div>
                      </div>
                  );
              }

              return (
                <div key={index} className="mb-4">
                  <h2 className="text-xs font-bold text-gray-500 dark:text-gray-400 border-b-2 border-gray-200 dark:border-slate-600 pb-1 mb-2 uppercase tracking-widest">
                    {section.title}
                  </h2>
                  <div className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                    {renderFormattedText(section.content)}
                  </div>
                </div>
              );
            })}
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
