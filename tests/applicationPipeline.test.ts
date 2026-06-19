import { describe, expect, it } from 'vitest';
import {
  getApplicationTimelineStageState,
  normalizeSkippedApplicationStatuses,
} from '../lib/applicationPipeline';

describe('application pipeline skipped stages', () => {
  it('normalizes skipped statuses in canonical pipeline order', () => {
    expect(normalizeSkippedApplicationStatuses([
      'first interview',
      'unknown stage',
      'Group Interview',
      'First Interview',
      'Rejected',
    ])).toEqual(['Group Interview', 'First Interview']);
  });

  it('renders explicitly skipped earlier stages as skipped instead of done', () => {
    expect(getApplicationTimelineStageState('Second Interview', 'Group Interview', ['Group Interview'])).toBe('skipped');
    expect(getApplicationTimelineStageState('Second Interview', 'First Interview', ['First Interview'])).toBe('skipped');
    expect(getApplicationTimelineStageState('Second Interview', 'Second Interview', ['Group Interview'])).toBe('current');
  });

  it('keeps legacy earlier stages as done when no skip record exists', () => {
    expect(getApplicationTimelineStageState('Second Interview', 'First Interview', [])).toBe('done');
  });

  it('marks final signed stages as done for the completed candidate view', () => {
    expect(getApplicationTimelineStageState('Signed', 'Signed', [])).toBe('done');
  });
});
