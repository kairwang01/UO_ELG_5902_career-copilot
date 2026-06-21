import { defineConfig } from 'vitest/config';

// The emulator-backed suites (firestore.rules + jobPostings.callable) share one
// Firestore emulator and each clears it in beforeEach, so they must NOT run in
// parallel or they race. Force sequential file execution.
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    fileParallelism: false,
    sequence: { concurrent: false },
    testTimeout: 15000,
    // Coverage (activated only with --coverage, via `npm run test:coverage`) is scoped
    // to the pure, deterministic core-logic modules the non-emulator unit suite
    // exercises — NOT the whole app (most UI has no unit tests and would mask the
    // signal). Gates those modules at the M5 target.
    coverage: {
      provider: 'v8',
      include: [
        'lib/applicationPipeline.ts',
        'lib/resumePreview.ts',
        'lib/skillMatch.ts',
        'lib/access/businessAccess.ts',
        'lib/access/navigationDecisions.ts',
        'lib/access/sessionTransitions.ts',
      ],
      reporter: ['text', 'html'],
      thresholds: { lines: 80, functions: 80, statements: 80, branches: 75 },
    },
  },
});
