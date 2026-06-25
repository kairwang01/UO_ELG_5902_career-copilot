import { describe, expect, it } from 'vitest';
import {
  SEPOLIA_CHAIN_ID,
  SEPOLIA_EXPLORER_ORIGIN,
  getSepoliaAddressUrl,
  normalizeWalletAddressForDisplay,
} from '../lib/web3Links';

describe('web3 testnet links', () => {
  it('uses Sepolia as the only explorer target', () => {
    expect(SEPOLIA_CHAIN_ID).toBe(11155111);
    expect(SEPOLIA_EXPLORER_ORIGIN).toBe('https://sepolia.etherscan.io');
  });

  it('normalizes and links wallet addresses to Sepolia Etherscan', () => {
    expect(normalizeWalletAddressForDisplay(' 0xabcDEF ')).toBe('0xabcDEF');
    expect(getSepoliaAddressUrl(' 0xabcDEF ')).toBe(
      'https://sepolia.etherscan.io/address/0xabcDEF',
    );
  });

  it('does not create explorer links for missing addresses', () => {
    expect(getSepoliaAddressUrl('   ')).toBeNull();
    expect(getSepoliaAddressUrl(null)).toBeNull();
  });
});
