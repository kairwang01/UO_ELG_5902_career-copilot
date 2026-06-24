import { describe, it, expect, vi } from 'vitest';

// aiClient imports firebaseClient (which initializes a Firebase app on load).
// Stub it so the pure error-mapping function can be unit-tested in isolation.
vi.mock('../lib/firebaseClient', () => ({ firebaseFunctions: {} }));

import { formatCallableError } from '../services/aiClient';

describe('formatCallableError — AI unavailable / unconfigured', () => {
  it('never leaks provider-key / Admin Portal config text to end users', () => {
    const msg = formatCallableError({
      code: 'functions/unavailable',
      message: 'GEMINI_API_KEY is not set. Add it via Admin Portal or functions/.env.',
    });
    expect(msg).not.toMatch(/GEMINI|API_KEY|Admin Portal|\.env/i);
    expect(msg.toLowerCase()).toContain('temporarily unavailable');
  });

  it('maps a bare "is not set" message (no code) to neutral copy', () => {
    const msg = formatCallableError({ message: 'KAIRLLM_API_KEY is not set.' });
    expect(msg).not.toMatch(/KAIRLLM|API_KEY/i);
    expect(msg.toLowerCase()).toContain('temporarily unavailable');
  });

  it('still maps quota errors to the busy message', () => {
    expect(formatCallableError({ code: 'functions/resource-exhausted', message: 'quota' }).toLowerCase())
      .toContain('busy');
  });

  it('still maps unauthenticated to a sign-in prompt', () => {
    expect(formatCallableError({ code: 'functions/unauthenticated', message: '' }).toLowerCase())
      .toContain('sign in');
  });

  it('still maps insufficient-credits without leaking the tool slug', () => {
    const msg = formatCallableError({
      code: 'functions/failed-precondition',
      message: 'Not enough credits for resume-analysis',
    });
    expect(msg).not.toMatch(/resume-analysis/);
    expect(msg.toLowerCase()).toContain('credit');
  });
});
