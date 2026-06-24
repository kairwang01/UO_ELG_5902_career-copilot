import { test, expect } from '@playwright/test';

/**
 * Web3 credential smoke: with the module enabled, a mint-eligible candidate can
 * connect a wallet and mint the Proof-of-Talent credential. The contract address
 * is a placeholder, so the app runs its labelled "testnet preview" path — the
 * wallet connection is real (ethers + injected provider) but mint/stake/claim are
 * simulated and persisted to the profile. This locks the Web3 闭环 end to end.
 *
 * window.ethereum is mocked (no real wallet/extension in CI). The seed provides
 * platform_config/web3.enabled + a score-90 resume analysis so the mint CTA shows.
 */
// Dedicated mint-eligible candidate (seeded with a score-90 analysis), kept
// separate from the happy-path's candidate so neither fixture disturbs the other.
const CANDIDATE = { email: 'web3@careercopilot.test', password: 'QaSeed!2026' };
const WALLET = '0x1111111111111111111111111111111111111111';

test.beforeEach(async ({ page }) => {
  await page.addInitScript((wallet) => {
    try {
      localStorage.setItem('preferred_language', 'en');
      localStorage.setItem('feature_web3_enabled', 'true');
    } catch {
      /* ignore */
    }
    // Minimal EIP-1193 provider so ethers' BrowserProvider can resolve a signer.
    (window as unknown as { ethereum: unknown }).ethereum = {
      isMetaMask: true,
      request: async ({ method }: { method: string }) => {
        if (method === 'eth_chainId') return '0xaa36a7'; // Sepolia
        if (method === 'net_version') return '11155111';
        if (method === 'eth_accounts' || method === 'eth_requestAccounts') return [wallet];
        if (method === 'eth_blockNumber') return '0x1';
        return null;
      },
      on: () => {},
      removeListener: () => {},
    };
  }, WALLET);
});

test('candidate connects a wallet and mints the testnet-preview credential', async ({ page }) => {
  await page.goto('/workspace?auth=signin');
  await page.locator('input[type="email"]').first().fill(CANDIDATE.email);
  await page.locator('input[type="password"]').first().fill(CANDIDATE.password);
  await page.locator('form button[type="submit"]').first().click();

  await expect(page.locator('[data-qa-shell="candidate"]')).toBeVisible({ timeout: 30_000 });

  // Open Account settings, where the Web3 credential lives.
  await page.locator('[data-qa="candidate-nav-account"]').click();

  // Module is clearly labelled as a testnet preview (never claims on-chain value).
  await expect(page.getByText(/Testnet preview/i)).toBeVisible({ timeout: 30_000 });

  // Connect the mocked wallet → status flips to Connected + address is shown.
  await page.getByRole('button', { name: /connect wallet/i }).click();
  await expect(page.getByText('Connected').first()).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(WALLET, { exact: false }).first()).toBeVisible();

  // Eligible (seeded score 90) → mint the preview credential.
  await expect(page.getByText(/You Qualify/i)).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: /mint my credential/i }).click();

  // Credential minted + persisted → the credential status reads Minted.
  await expect(page.getByText('Minted').first()).toBeVisible({ timeout: 20_000 });
});
