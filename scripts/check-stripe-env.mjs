import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ENV_PATH = resolve(ROOT, 'functions/.env');

const REQUIRED_PRICE_KEYS = [
  'STRIPE_PRICE_ESSENTIALS',
  'STRIPE_PRICE_ACCELERATOR',
  'STRIPE_PRICE_EXECUTIVE',
  'STRIPE_PRICE_STARTER',
  'STRIPE_PRICE_GROWTH',
  'STRIPE_PRICE_PRO',
  'STRIPE_PRICE_SINGLE_POST',
  'STRIPE_PRICE_JOB_PACK',
  'STRIPE_PRICE_PACK_100',
  'STRIPE_PRICE_PACK_500',
  'STRIPE_PRICE_PACK_1000',
];

function parseDotEnv(path) {
  const values = {};
  if (!existsSync(path)) return values;
  const text = readFileSync(path, 'utf8');
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const equalsIndex = line.indexOf('=');
    if (equalsIndex <= 0) continue;
    const key = line.slice(0, equalsIndex).trim();
    let value = line.slice(equalsIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
}

const env = { ...parseDotEnv(ENV_PATH), ...process.env };
const issues = [];
const warnings = [];

function requireValue(key, label = key) {
  if (!env[key]) issues.push(`${label} is missing`);
  return env[key] || '';
}

function assertPrefix(key, prefix) {
  const value = requireValue(key);
  if (value && !value.startsWith(prefix)) {
    issues.push(`${key} should start with "${prefix}"`);
  }
}

function assertUrl(key) {
  const value = requireValue(key);
  if (!value) return;
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) {
      issues.push(`${key} must be an http(s) URL`);
    }
  } catch {
    issues.push(`${key} must be a valid URL`);
  }
}

assertUrl('APP_BASE_URL');
assertPrefix('STRIPE_SECRET_KEY', 'sk_');
assertPrefix('STRIPE_WEBHOOK_SECRET', 'whsec_');
for (const key of REQUIRED_PRICE_KEYS) {
  assertPrefix(key, 'price_');
}

if (env.BILLING_SIMULATION === 'true') {
  warnings.push('BILLING_SIMULATION=true means real Stripe Checkout is bypassed.');
}

if (issues.length) {
  console.error('Stripe env check failed:');
  for (const issue of issues) console.error(` - ${issue}`);
  console.error('\nNo secret values were printed. Set missing values in functions/.env locally or Firebase Secret Manager for deploy.');
  process.exit(1);
}

console.log('Stripe env check passed. No secret values printed.');
for (const warning of warnings) console.warn(`Warning: ${warning}`);
