import { describe, expect, it } from 'vitest';
import {
  buildApplicationPipelinePlan,
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

  it('builds a single timeline plan for current, skipped, and pending stages', () => {
    const plan = buildApplicationPipelinePlan('Second Interview', ['Group Interview']);

    expect(plan.status).toBe('Second Interview');
    expect(plan.currentGroup.id).toBe('interview');
    expect(plan.progressPercent).toBe(45);
    expect(plan.groups.find((group) => group.group.id === 'interview')?.state).toBe('current');
    expect(plan.stages.find((stage) => stage.stage.status === 'Group Interview')?.state).toBe('skipped');
    expect(plan.stages.find((stage) => stage.stage.status === 'First Interview')?.state).toBe('done');
    expect(plan.stages.find((stage) => stage.stage.status === 'Second Interview')?.state).toBe('current');
    expect(plan.stages.find((stage) => stage.stage.status === 'Decision Maker Interview')?.state).toBe('pending');
  });

  it('marks a fully skipped macro group as skipped instead of completed', () => {
    const plan = buildApplicationPipelinePlan('Offer', [
      'Group Interview',
      'First Interview',
      'Second Interview',
      'Decision Maker Interview',
      'HR Interview',
    ]);

    const interviewGroup = plan.groups.find((group) => group.group.id === 'interview');
    expect(interviewGroup?.fullySkipped).toBe(true);
    expect(interviewGroup?.state).toBe('skipped');
    expect(interviewGroup?.connectorDone).toBe(false);
    expect(plan.currentGroup.id).toBe('offer');
  });

  it('handles terminal rejected and signed plans consistently', () => {
    const rejected = buildApplicationPipelinePlan('Rejected');
    expect(rejected.progressPercent).toBe(0);
    expect(rejected.groups.every((group) => group.state === 'closed')).toBe(true);

    const signed = buildApplicationPipelinePlan('Signed');
    expect(signed.progressPercent).toBe(100);
    expect(signed.isComplete).toBe(true);
    expect(signed.groups.at(-1)?.state).toBe('done');
  });
});
