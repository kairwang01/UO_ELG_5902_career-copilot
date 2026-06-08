/**
 * Beta redesign screenshot QA — desktop + mobile viewports.
 * Usage: VITE_BETA_REDESIGN=true npm run dev  (separate terminal)
 *        node beta/scripts/screenshot-qa.mjs
 */
import { mkdir } from 'fs/promises';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, '../qa-screenshots');
const base = process.env.QA_BASE_URL || 'http://localhost:3000';

const routes = ['/', '/employers', '/sample-report', '/pricing', '/portal', '/app'];
const viewports = [
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'mobile', width: 390, height: 844 },
];

async function waitForServer(url, attempts = 30) {
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`Server not ready at ${url}`);
}

async function main() {
  let dev = null;
  const needStart = process.env.QA_SKIP_DEV !== '1';

  if (needStart) {
    dev = spawn('npm', ['run', 'dev'], {
      cwd: path.join(__dirname, '../..'),
      env: { ...process.env, VITE_BETA_REDESIGN: 'true' },
      stdio: 'pipe',
    });
    await waitForServer(base);
  } else {
    await waitForServer(base);
  }

  const { chromium } = await import('playwright');
  await mkdir(outDir, { recursive: true });

  const browser = await chromium.launch();
  const issues = [];

  for (const vp of viewports) {
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await context.newPage();

    for (const route of routes) {
      const slug = route === '/' ? 'home' : route.replace(/^\//, '').replace(/\//g, '-');
      const file = path.join(outDir, `${slug}-${vp.name}.png`);
      try {
        await page.goto(`${base}${route}`, { waitUntil: 'networkidle', timeout: 60000 });
        await page.waitForTimeout(500);
        const overflow = await page.evaluate(() => ({
          sw: document.documentElement.scrollWidth,
          cw: document.documentElement.clientWidth,
        }));
        if (overflow.sw > overflow.cw + 2) {
          issues.push(`${route} @ ${vp.name}: horizontal overflow (${overflow.sw}px > ${overflow.cw}px)`);
        }
        await page.screenshot({ path: file, fullPage: true });
        console.log(`✓ ${file}`);
      } catch (err) {
        issues.push(`${route} @ ${vp.name}: ${err.message}`);
        console.error(`✗ ${route} ${vp.name}`, err.message);
      }
    }
    await context.close();
  }

  await browser.close();
  if (dev) dev.kill('SIGTERM');

  const reportPath = path.join(outDir, 'QA-REPORT.md');
  const report = `# Beta Screenshot QA\n\nGenerated: ${new Date().toISOString()}\n\n## Routes\n${routes.map((r) => `- \`${r}\``).join('\n')}\n\n## Viewports\n${viewports.map((v) => `- ${v.name} ${v.width}×${v.height}`).join('\n')}\n\n## Issues\n${issues.length ? issues.map((i) => `- ${i}`).join('\n') : '- None detected (overflow check only)'}\n`;
  await import('fs/promises').then((fs) => fs.writeFile(reportPath, report));
  console.log(`\nReport: ${reportPath}`);
  if (issues.length) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
