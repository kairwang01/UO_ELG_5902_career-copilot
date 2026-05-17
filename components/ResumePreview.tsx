import React from 'react';
import { renderFormattedText } from './tools/ToolUtils';

interface ResumePreviewProps {
  resumeText: string;
  market: string;
  t: (key: string) => string;
}

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
    
    let contentStarted = false;

    for (const line of lines) {
        const trimmedLine = line.trim();
        // A line is likely a header if it matches keywords and is not too long.
        const isLikelyHeader = headerRegex.test(trimmedLine) && trimmedLine.length < 50;
        
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
  const sections = parseResumeSections(resumeText);

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
                      <div key={index} className="text-center mb-6 pb-4 border-b dark:border-slate-600">
                          <div className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-wrap">
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
