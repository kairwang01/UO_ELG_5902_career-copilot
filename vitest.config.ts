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
  },
});
