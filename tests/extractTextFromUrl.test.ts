import { describe, expect, it } from 'vitest';
import { assertSafeUrl, isBlockedIpAddress } from '../functions/src/handlers/extractTextFromUrl';

describe('extractTextFromUrl SSRF guard', () => {
  it('blocks private, loopback, link-local, and mapped private addresses', () => {
    expect(isBlockedIpAddress('127.0.0.1')).toBe(true);
    expect(isBlockedIpAddress('10.1.2.3')).toBe(true);
    expect(isBlockedIpAddress('172.16.0.1')).toBe(true);
    expect(isBlockedIpAddress('192.168.1.10')).toBe(true);
    expect(isBlockedIpAddress('169.254.169.254')).toBe(true);
    expect(isBlockedIpAddress('::1')).toBe(true);
    expect(isBlockedIpAddress('fc00::1')).toBe(true);
    expect(isBlockedIpAddress('fe80::1')).toBe(true);
    expect(isBlockedIpAddress('::ffff:10.0.0.1')).toBe(true);
  });

  it('allows ordinary public addresses', () => {
    expect(isBlockedIpAddress('8.8.8.8')).toBe(false);
    expect(isBlockedIpAddress('2606:4700:4700::1111')).toBe(false);
  });

  it('rejects unsafe URL schemes, hostnames, and non-default ports', () => {
    expect(() => assertSafeUrl('file:///etc/passwd')).toThrow();
    expect(() => assertSafeUrl('http://localhost/profile')).toThrow();
    expect(() => assertSafeUrl('http://metadata.google.internal/latest')).toThrow();
    expect(() => assertSafeUrl('https://example.com:8443/resume')).toThrow();
    expect(() => assertSafeUrl('http://example.com:8080/resume')).toThrow();
  });

  it('accepts default-port public http/https URLs', () => {
    expect(assertSafeUrl('https://example.com/resume').hostname).toBe('example.com');
    expect(assertSafeUrl('https://example.com:443/resume').hostname).toBe('example.com');
    expect(assertSafeUrl('http://example.com:80/resume').hostname).toBe('example.com');
  });
});
