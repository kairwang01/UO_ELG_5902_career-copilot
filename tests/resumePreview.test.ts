import { describe, expect, it } from 'vitest';
import { assessFormattedResume, cleanResumeDisplay, getResumeMarketStyle, parseResumeSections } from '../lib/resumePreview';

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

  it('normalizes markdown section labels before parsing', () => {
    const sections = parseResumeSections(cleanResumeDisplay('Jane Doe\n**SUMMARY**\nBuilt hiring workflows.\n## Skills\nResearch, Jira, SQL'));
    expect(sections.map((section) => section.title)).toEqual(['Header', 'SUMMARY', 'Skills']);
  });

  it('maps resume preview style by target market', () => {
    expect(getResumeMarketStyle('Canada').region).toBe('north-america');
    expect(getResumeMarketStyle('Germany').pageSize).toBe('a4');
    expect(getResumeMarketStyle('Japan').region).toBe('japan');
    expect(getResumeMarketStyle('Singapore').region).toBe('apac');
  });

  it('passes a clean sectioned resume (and does not mistake a pipe-separated skills line for a table)', () => {
    const clean = 'Jane Doe\nEmail: jane@example.com\nSUMMARY\nProduct manager with 6 years of experience.\nEXPERIENCE\nLed a team of 5 engineers.\nSKILLS\nReact | Node | SQL';
    expect(assessFormattedResume(clean).status).toBe('ok');
  });

  it('flags an unstructured blob as needs_regen', () => {
    const blob = 'Alex is a software engineer who has worked at several companies building web applications, leading teams, shipping products to production, mentoring engineers, improving processes, and collaborating across functions for many years. '.repeat(3);
    expect(assessFormattedResume(blob).status).toBe('needs_regen');
  });

  it('flags a surviving photo placeholder as needs_regen', () => {
    const withPhoto = 'Jane Doe\nEmail: jane@example.com\nSUMMARY\nProduct manager.\nEXPERIENCE\nLed teams.\n[Photo]';
    const result = assessFormattedResume(withPhoto);
    expect(result.status).toBe('needs_regen');
    expect(result.issues).toContain('photo_placeholder');
  });

  it('warns (non-blocking) on fabricated-looking sensitive fields', () => {
    const withDob = 'Jane Doe\nEmail: jane@example.com\nSUMMARY\nProduct manager.\nEXPERIENCE\nLed teams.\nDate of Birth: 1990-01-01';
    expect(assessFormattedResume(withDob).status).toBe('warn');
  });

  it('repairs Japanese inline resume output before preview parsing', () => {
    const raw = '氏名：王铂凯（おうはくがい） 電話番号：130-2254-7015 メールアドレス：jackson@example.com 所在地：カナダ、オタワ ウェブサイト：https://kairwang.cloud 写真：[ここに証明写真を貼付] ■ 志望動機 プロジェクトマネジメント候補者として貢献したいです。 ■ 学歴 | 年月 | 学校名 | 専攻 | 成績 | 2025年09月〜2027年06月（予定） | オタワ大学 | 電気・コンピュータ工学 | GPA 4.0/4.0';
    const cleaned = cleanResumeDisplay(raw);
    const sections = parseResumeSections(cleaned);

    expect(cleaned).not.toContain('写真');
    expect(cleaned).not.toContain('ここに証明写真');
    expect(cleaned).toContain('\n電話番号: 130-2254-7015');
    expect(sections.map((section) => section.title)).toContain('志望動機');
    expect(sections.map((section) => section.title)).toContain('学歴');
  });

  it('strips an inline fullwidth-bracket photo placeholder', () => {
    const raw = '王凱 ウェブサイト：https://example.com 写真: ［ここに証明写真を貼付］ 志望動機 貢献したいです。';
    const cleaned = cleanResumeDisplay(raw);
    expect(cleaned).not.toContain('写真');
    expect(cleaned).not.toContain('証明写真');
  });
});
