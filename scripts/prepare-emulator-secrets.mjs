/**
 * Functions emulator helper.
 *
 * Some deployed functions declare Secret Manager bindings. In local emulator
 * runs, Firebase tries to resolve those secrets before the callable body can
 * fall back to process.env. This writes harmless local-only placeholders so
 * runtime smokes can exercise simulation paths without real Stripe secrets.
 *
 * The target file is ignored by git (`*.local`) and existing values are kept.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const path = new URL('../functions/.secret.local', import.meta.url);

function parseEnv(text) {
  const values = {};
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match) values[match[1]] = match[2];
  }
  return values;
}

const current = existsSync(path) ? parseEnv(readFileSync(path, 'utf8')) : {};
const next = {
  STRIPE_SECRET_KEY: current.STRIPE_SECRET_KEY || 'sk_test_emulator_placeholder',
  STRIPE_WEBHOOK_SECRET: current.STRIPE_WEBHOOK_SECRET || 'whsec_emulator_placeholder',
};

writeFileSync(
  path,
  `${Object.entries(next).map(([key, value]) => `${key}=${value}`).join('\n')}\n`,
  { mode: 0o600 },
);

console.log('Prepared functions/.secret.local for emulator secrets (values not printed).');
