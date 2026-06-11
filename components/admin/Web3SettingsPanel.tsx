import React, { useEffect, useState } from 'react';
import { Card, SectionHeading } from './adminUi';
import { isWeb3Enabled, onWeb3FlagChange, setWeb3Enabled } from '../../config/featureFlags';

/**
 * Web3 settings tab — experimental module control.
 *
 * Web3 in this product is strictly optional identity tooling: candidates may
 * connect a wallet and hold a Proof-of-Talent credential (Sepolia testnet).
 * Nothing in the core product — auth, payments, hiring portal, AI tools —
 * depends on a wallet. This panel turns the whole surface on/off.
 */
export const Web3SettingsPanel: React.FC = () => {
  const [enabled, setEnabled] = useState(isWeb3Enabled());

  useEffect(() => onWeb3FlagChange(setEnabled), []);

  const toggle = () => setWeb3Enabled(!enabled);

  return (
    <div className="max-w-2xl space-y-5">
      {/* Experimental banner */}
      <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <span className="mt-0.5 shrink-0" aria-hidden="true">⚠</span>
        <p>
          <span className="font-semibold">Experimental module.</span>{' '}
          Runs on the Sepolia testnet only. No real funds are involved and the core
          product never requires a wallet.
        </p>
      </div>

      <Card className="p-5 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <SectionHeading>Web3 identity module</SectionHeading>
            <p className="mt-1 text-xs leading-relaxed text-gray-500">
              Controls the candidate-facing surface: the wallet section in Account and the
              Identity &amp; Wallet workspace view (Proof-of-Talent credential, staking, rewards).
              When off, both are hidden entirely — sign-in, payments and all AI features are unaffected.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            aria-label="Toggle Web3 module"
            onClick={toggle}
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${enabled ? 'bg-blue-600' : 'bg-gray-300'}`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${enabled ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>
        <p className={`text-xs font-medium ${enabled ? 'text-emerald-700' : 'text-gray-500'}`}>
          {enabled ? 'Enabled — candidates can see the wallet and credential surfaces.' : 'Disabled — all Web3 surfaces are hidden from the product.'}
        </p>
        <p className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-[11px] leading-relaxed text-gray-500">
          Scope note: this switch currently persists per browser (demo mode). Platform-wide
          persistence moves to <code className="font-mono">platform_config</code> together with the
          API platform callables — <code className="font-mono">config/featureFlags.ts</code> is the
          single swap point.
        </p>
      </Card>

      <Card className="p-5 space-y-4">
        <SectionHeading>What Web3 is used for here</SectionHeading>
        <ul className="space-y-2.5">
          {[
            ['Wallet connection (live)', 'Optional identity link on the candidate Account page. Connection failures fall back to the normal account — nothing is blocked.'],
            ['Proof-of-Talent credential (live, testnet)', 'Candidates scoring 85+ on resume analysis can mint a verification credential; employers see verified status in the talent pool.'],
            ['Credential verification (planned)', 'Third-party verification of issued credentials via the public contract — design reserved, no UI yet.'],
            ['Developer settlement (placeholder)', 'Token-based settlement for API-platform partners is a research item only; nothing is implemented or scheduled.'],
          ].map(([title, desc]) => (
            <li key={title} className="rounded-md border border-gray-200 px-3 py-2.5">
              <p className="text-xs font-semibold text-gray-900">{title}</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-gray-500">{desc}</p>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="p-5">
        <SectionHeading>Contract</SectionHeading>
        <dl className="mt-3 space-y-2 text-xs">
          <div className="flex flex-wrap gap-x-3">
            <dt className="text-gray-500 shrink-0">Network</dt>
            <dd className="font-mono text-gray-800">Sepolia testnet (chain 11155111)</dd>
          </div>
          <div className="flex flex-wrap gap-x-3">
            <dt className="text-gray-500 shrink-0">Proof-of-Talent</dt>
            <dd className="font-mono text-gray-800 break-all">0x2A3b1A43842238321a22542a035921A362358189</dd>
          </div>
        </dl>
      </Card>
    </div>
  );
};
