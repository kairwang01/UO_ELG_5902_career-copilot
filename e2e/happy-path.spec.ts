import { test, expect } from '@playwright/test';

/**
 * SCRUM-42 — core happy path: authenticated candidate runs a tool and reaches
 * My Applications. Uses the pre-seeded (email-verified) candidate from
 * scripts/seed-emulator.mjs because a fresh UI signup requires email verification
 * before workspace access; the seeded account exercises the same authed journey.
 * The LLM is stubbed (E2E_LLM_STUB) so the tool run is deterministic and free.
 */
const CANDIDATE = { email: 'candidate@careercopilot.test', password: 'QaSeed!2026' };

test.beforeEach(async ({ page }) => {
  // Force English so text-based assertions/selectors are deterministic.
  await page.addInitScript(() => {
    try {
      localStorage.setItem('preferred_language', 'en');
    } catch {
      /* ignore */
    }
  });
});

test('candidate can sign in, run a tool, and reach My Applications', async ({ page }) => {
  // 1) Sign in with the seeded, verified candidate.
  await page.goto('/workspace?auth=signin');
  await page.locator('input[type="email"]').first().fill(CANDIDATE.email);
  await page.locator('input[type="password"]').first().fill(CANDIDATE.password);
  await page.locator('form button[type="submit"]').first().click();

  // 2) Authenticated workspace loads (credits badge "… CR" appears post-login).
  await expect(page.getByText(/\bCR\b/).first()).toBeVisible({ timeout: 30_000 });

  // 3) Tool run - resume readiness. The seeded candidate already has resume_text, so
  //    the dashboard's primary readiness action runs resume analysis (stubbed LLM).
  await page.goto('/workspace');
  const readinessBtn = page.getByRole('button', { name: /run readiness pass/i }).first();
  await readinessBtn.waitFor({ state: 'visible', timeout: 30_000 });
  await readinessBtn.click();

  // A credit-confirmation dialog may appear - confirm via its primary action.
  const dialog = page.getByRole('dialog');
  if (await dialog.isVisible().catch(() => false)) {
    await dialog.getByRole('button').last().click();
  }

  // Meaningful signal: the pre-analysis "first score" empty-state hint is only
  // replaced once the analysis actually completes (avoids matching pre-existing copy).
  await expect(
    page.getByText(/run a readiness pass to create the first score/i),
  ).toBeHidden({ timeout: 60_000 });

  // 4) My Applications renders via the sidebar nav (exact label avoids "Applied pipeline").
  await page.getByRole('button', { name: 'Applications', exact: true }).click();
  await expect(page.getByText(/application/i).first()).toBeVisible({ timeout: 20_000 });
});
