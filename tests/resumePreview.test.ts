import { describe, expect, it } from 'vitest';
import { cleanResumeDisplay, parseResumeSections } from '../lib/resumePreview';

describe('ResumePreview parsing', () => {
  it('recovers CJK section breaks from a one-line extracted resume', () => {
    const raw = '王凯 电话：13022547015 • 个人网站：https://kairwang.cloud • Email: jackson@example.com 渥太华，加拿大综合能力概述项目管理候选人，具备跨团队协作经验。教育背景渥太华大学 09/2025 - 06/2027 项目经历Career CoPilot • 统筹 6 人工程团队 • 推进生产版本';
    const cleaned = cleanResumeDisplay(raw);
    const sections = parseResumeSections(cleaned);

    expect(sections.map((section) => section.title)).toContain('综合能力概述');
    expect(sections.map((section) => section.title)).toContain('教育背景');
    expect(sections.map((section) => section.title)).toContain('项目经历');
  });

  it('keeps ordinary free-text resumes renderable', () => {
    const sections = parseResumeSections(cleanResumeDisplay('Jane Doe\nEmail: jane@example.com\nExperience\nBuilt hiring workflows.'));
    expect(sections.map((section) => section.title)).toEqual(['Header', 'Experience']);
  });
});
