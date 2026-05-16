import { describe, expect, it } from 'vitest';
import { resolveRedirectTarget, sanitizeRedirectPath } from './safe-redirect';

describe('sanitizeRedirectPath', () => {
  it('returns same-origin absolute paths as-is', () => {
    expect(sanitizeRedirectPath('/en/dashboard')).toBe('/en/dashboard');
    expect(sanitizeRedirectPath('/de/contracts/42')).toBe('/de/contracts/42');
    expect(sanitizeRedirectPath('/')).toBe('/');
  });

  it('preserves query string and hash on same-origin paths', () => {
    expect(sanitizeRedirectPath('/en/dashboard?tab=upcoming')).toBe('/en/dashboard?tab=upcoming');
    expect(sanitizeRedirectPath('/en/dashboard#section')).toBe('/en/dashboard#section');
  });

  it('rejects absolute URLs pointing to a different origin', () => {
    expect(sanitizeRedirectPath('https://evil.example/phish')).toBeNull();
    expect(sanitizeRedirectPath('http://evil.example')).toBeNull();
  });

  it('rejects protocol-relative URLs (`//host`)', () => {
    expect(sanitizeRedirectPath('//evil.example')).toBeNull();
    expect(sanitizeRedirectPath('//evil.example/path')).toBeNull();
  });

  it('rejects the `/\\` browser quirk that some browsers treat as protocol-relative', () => {
    expect(sanitizeRedirectPath('/\\evil.example')).toBeNull();
    expect(sanitizeRedirectPath('/\\\\evil.example')).toBeNull();
  });

  it('rejects values containing whitespace or control characters', () => {
    expect(sanitizeRedirectPath('/en/dashboard\n')).toBeNull();
    expect(sanitizeRedirectPath('/en/ dashboard')).toBeNull();
    expect(sanitizeRedirectPath('/en/dashboard\t')).toBeNull();
  });

  it('rejects non-absolute paths', () => {
    expect(sanitizeRedirectPath('en/dashboard')).toBeNull();
    expect(sanitizeRedirectPath('./dashboard')).toBeNull();
    expect(sanitizeRedirectPath('javascript:alert(1)')).toBeNull();
    expect(sanitizeRedirectPath('data:text/html,<script>')).toBeNull();
  });

  it('rejects non-string values', () => {
    expect(sanitizeRedirectPath(undefined)).toBeNull();
    expect(sanitizeRedirectPath(null)).toBeNull();
    expect(sanitizeRedirectPath(42)).toBeNull();
    expect(sanitizeRedirectPath(['/dashboard'])).toBeNull();
    expect(sanitizeRedirectPath('')).toBeNull();
  });

  it('rejects redirects that point back at an auth page (loop guard)', () => {
    expect(sanitizeRedirectPath('/en/auth/login')).toBeNull();
    expect(sanitizeRedirectPath('/de/auth/register')).toBeNull();
    expect(sanitizeRedirectPath('/auth/login?next=/dashboard')).toBeNull();
  });
});

describe('resolveRedirectTarget', () => {
  it('returns the sanitised candidate when safe', () => {
    expect(resolveRedirectTarget('/en/dashboard', 'en', '/')).toBe('/en/dashboard');
  });

  it('falls back to /<locale><fallback> when candidate is unsafe', () => {
    expect(resolveRedirectTarget('https://evil.example', 'en', '/')).toBe('/en/');
    expect(resolveRedirectTarget('//evil.example', 'de', '/')).toBe('/de/');
    expect(resolveRedirectTarget(undefined, 'fa', '/')).toBe('/fa/');
  });

  it('falls back when candidate points at the auth flow', () => {
    expect(resolveRedirectTarget('/en/auth/login', 'en', '/')).toBe('/en/');
  });
});
