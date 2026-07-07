import { describe, expect, it } from 'vitest';
import {
  correctiveInstruction,
  hasFinishedEnding,
  proseDraftIssues,
} from '../functions/src/llm/draftQuality';

describe('server-side draft quality review', () => {
  it('accepts finished endings across languages and trailing closers', () => {
    expect(hasFinishedEnding('We look forward to hearing from you.')).toBe(true);
    expect(hasFinishedEnding('期待您的回复。')).toBe(true);
    expect(hasFinishedEnding('感谢您的时间！')).toBe(true);
    expect(hasFinishedEnding('هل يمكننا التحدث؟')).toBe(true); // Arabic question mark
    expect(hasFinishedEnding('He said "we will follow up soon."')).toBe(true);
    expect(hasFinishedEnding('她说：「我们会尽快回复。」')).toBe(true); // CJK closing quote
    expect(hasFinishedEnding('**Thank you for your consideration.**')).toBe(true); // markdown bold
    expect(hasFinishedEnding('(details attached.)')).toBe(true);
  });

  it('rejects genuinely unfinished endings', () => {
    expect(hasFinishedEnding('I am writing to express my')).toBe(false);
    expect(hasFinishedEnding('我们的团队在过去三年中')).toBe(false);
    expect(hasFinishedEnding('- bullet without ending')).toBe(false);
    expect(hasFinishedEnding('')).toBe(false);
  });

  it('flags placeholders and template language as blocking', () => {
    expect(proseDraftIssues('Dear [Hiring Manager], I am excited to apply.')).toContain('placeholder');
    expect(proseDraftIssues('Dear Hiring Manager Name, thank you.')).toContain('placeholder');
    expect(proseDraftIssues('Mention a specific achievement here to prove fit.')).toContain('placeholder');
  });

  it('applies language-aware length minimums', () => {
    expect(proseDraftIssues('Too short.', { minWords: 50 })).toContain('too_short');
    expect(proseDraftIssues('这封信太短了。', { minCjkChars: 100 })).toContain('too_short');
    const longEnglish = `${'strong relevant evidence sentence '.repeat(20)}Thanks.`;
    expect(proseDraftIssues(longEnglish, { minWords: 50 })).toEqual([]);
  });

  it('returns empty for a clean finished draft and empty-slug for missing text', () => {
    expect(proseDraftIssues(undefined)).toEqual(['empty']);
    expect(proseDraftIssues('   ')).toEqual(['empty']);
    expect(proseDraftIssues('A complete short note.', {})).toEqual([]);
  });

  it('builds a corrective instruction that names failing fields and defects', () => {
    const instruction = correctiveInstruction(['summary:unfinished_ending', 'email:placeholder']);
    expect(instruction).toContain('summary, email');
    expect(instruction).toContain('cut off mid-sentence');
    expect(instruction).toContain('placeholders or template instructions');
    expect(instruction).toContain('Regenerate the COMPLETE');
  });
});
