/**
 * Beta redesign screenshot QA — desktop + mobile viewports.
 *
 * Hardened so a stale MVP dev server cannot produce false-green results:
 *  - Reserves a free port and starts Vite with --strictPort (Beta is default; opt out with VITE_BETA_REDESIGN=false).
 *  - Fails if a Beta route does not render the Beta app marker (data-beta-app).
 *  - Fails if a Beta route exposes the expected data-beta-page id.
 *  - Fails if forbidden MVP marketing strings leak into Beta routes.
 *  - Confirms /workspace stays the isolated MVP shell (no Beta marker).
 *
 * Usage:
 *   npm run marketing:qa              # starts its own dev server on a free port
 *   QA_SKIP_DEV=1 QA_BASE_URL=...   # reuse an already-running Beta server
 */
import { mkdir, writeFile } from 'fs/promises';
import { spawn } from 'child_process';
import net from 'net';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '../..');
const outDir = path.join(__dirname, '../qa-screenshots');

const viewports = [
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'mobile', width: 390, height: 844 },
];

/** Marketing routes carry a stable data-beta-page id; app routes intentionally do not. */
const betaRoutes = [
  { route: '/', pageId: 'jobseeker-home' },
  { route: '/employers', pageId: 'employer-landing' },
  { route: '/sample-report', pageId: 'sample-report' },
  { route: '/pricing', pageId: 'pricing' },
];
const appRoutes = [
  { route: '/workspace', expectAppShell: true },
  { route: '/portal', expectAppShell: true },
];

/** Strings that must NEVER appear on Beta routes (would mean the MVP leaked through). */
const FORBIDDEN_MVP_STRINGS = [
  'Go Beyond the Resume',
];

function getFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

async function waitForServer(url, attempts = 40) {
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Server not ready at ${url}`);
}

async function main() {
  const skipDev = process.env.QA_SKIP_DEV === '1';
  let dev = null;
  let base;

  if (skipDev) {
    base = process.env.QA_BASE_URL || 'http://localhost:3000';
    await waitForServer(base);
  } else {
    const port = Number(process.env.QA_PORT) || (await getFreePort());
    base = `http://localhost:${port}`;
    dev = spawn('npm', ['run', 'dev', '--', '--port', String(port), '--strictPort'], {
      cwd: projectRoot,
      env: { ...process.env },
      stdio: 'pipe',
    });
    dev.stderr?.on('data', (d) => process.stderr.write(`[vite] ${d}`));
    await waitForServer(base);
  }

  const { chromium } = await import('playwright');
  await mkdir(outDir, { recursive: true });
  const browser = await chromium.launch();

  const results = [];
  const failures = [];

  for (const vp of viewports) {
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await context.newPage();

    for (const target of [...betaRoutes, ...appRoutes]) {
      const { route } = target;
      const slug = route === '/' ? 'home' : route.replace(/^\//, '').replace(/\//g, '-');
      const file = path.join(outDir, `${slug}-${vp.name}.png`);
      const checks = [];
      let ok = true;

      const fail = (msg) => {
        ok = false;
        failures.push(`${route} @ ${vp.name}: ${msg}`);
        checks.push(`FAIL ${msg}`);
      };

      try {
        await page.goto(`${base}${route}`, { waitUntil: 'networkidle', timeout: 60000 });
        await page.waitForTimeout(500);

        const hasBetaMarker = (await page.locator('[data-beta-app="true"]').count()) > 0;

        if (target.expectAppShell) {
          if (hasBetaMarker) fail(`Marketing marker present on ${route} (app route isolation broken)`);
          else checks.push('OK app shell route (no marketing marker)');
        } else {
          if (!hasBetaMarker) {
            fail('missing data-beta-app marker (stale MVP server?)');
          } else {
            const pageId = await page.locator('[data-beta-app="true"]').first().getAttribute('data-beta-page');
            if (pageId !== target.pageId) fail(`data-beta-page="${pageId}" != "${target.pageId}"`);
            else checks.push(`OK data-beta-page=${pageId}`);
          }

          const bodyText = await page.evaluate(() => document.body.innerText);
          for (const forbidden of FORBIDDEN_MVP_STRINGS) {
            if (bodyText.includes(forbidden)) fail(`forbidden MVP string present: "${forbidden}"`);
          }
          if (ok) checks.push('OK no forbidden MVP strings');
        }

        const overflow = await page.evaluate(() => ({
          sw: document.documentElement.scrollWidth,
          cw: document.documentElement.clientWidth,
        }));
        if (overflow.sw > overflow.cw + 2) {
          fail(`horizontal overflow (${overflow.sw}px > ${overflow.cw}px)`);
        } else {
          checks.push('OK no horizontal overflow');
        }

        await page.screenshot({ path: file, fullPage: true });
      } catch (err) {
        fail(err.message);
      }

      results.push({ route, viewport: vp.name, ok, checks });
      console.log(`${ok ? '✓' : '✗'} ${route} @ ${vp.name}`);
      checks.forEach((c) => console.log(`    ${c}`));
    }

    await context.close();
  }

  // Locale smoke test: switch to zh, confirm translated copy renders and no raw beta_ keys leak.
  const localeChecks = [];
  try {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    await page.goto(`${base}/`, { waitUntil: 'networkidle', timeout: 60000 });
    await page.evaluate(() => localStorage.setItem('preferred_language', 'zh'));
    await page.goto(`${base}/`, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(800);
    const bodyText = await page.evaluate(() => document.body.innerText);

    if (bodyText.includes('上传简历')) localeChecks.push('OK zh hero copy rendered');
    else {
      localeChecks.push('FAIL zh hero copy missing');
      failures.push('locale zh: expected translated hero copy not found');
    }

    const rawKeyLeak = /\bsite_[a-z0-9_]+\b/.test(bodyText);
    if (rawKeyLeak) {
      localeChecks.push('FAIL raw site_ key leaked in zh render');
      failures.push('locale zh: raw site_* key visible (missing translation)');
    } else {
      localeChecks.push('OK no raw site_ keys in zh render');
    }
    await ctx.close();
  } catch (err) {
    localeChecks.push(`FAIL ${err.message}`);
    failures.push(`locale zh: ${err.message}`);
  }
  console.log(`\nLocale smoke (zh):`);
  localeChecks.forEach((c) => console.log(`    ${c}`));

  await browser.close();
  if (dev) dev.kill('SIGTERM');

  const lines = results.map(
    (r) => `### \`${r.route}\` @ ${r.viewport} — ${r.ok ? 'PASS' : 'FAIL'}\n${r.checks.map((c) => `- ${c}`).join('\n')}`,
  );
  const report = `# Beta Screenshot QA

Generated: ${new Date().toISOString()}
Server: ${base} (VITE_BETA_REDESIGN=${skipDev ? 'reused server' : 'true'})

## Summary

- Routes checked: ${betaRoutes.length} marketing + ${appRoutes.length} app shell
- Viewports: ${viewports.map((v) => `${v.name} ${v.width}x${v.height}`).join(', ')}
- Result: ${failures.length === 0 ? 'ALL PASS' : `${failures.length} failure(s)`}

## Assertions per route

- data-beta-app marker present (marketing routes) / absent (app routes)
- data-beta-page matches expected id
- no forbidden MVP strings: ${FORBIDDEN_MVP_STRINGS.map((s) => `"${s}"`).join(', ')}
- no horizontal overflow

## Results

${lines.join('\n\n')}

## Locale smoke (zh)

${localeChecks.map((c) => `- ${c}`).join('\n')}

${failures.length ? `## Failures\n\n${failures.map((f) => `- ${f}`).join('\n')}` : '## Failures\n\nNone.'}
`;

  await writeFile(path.join(outDir, 'QA-REPORT.md'), report);
  console.log(`\nReport: ${path.join(outDir, 'QA-REPORT.md')}`);

  if (failures.length) {
    console.error(`\n${failures.length} QA failure(s).`);
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
