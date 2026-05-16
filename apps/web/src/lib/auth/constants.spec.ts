import { describe, expect, it } from 'vitest';
import { toApiLocale } from './constants';

describe('toApiLocale', () => {
  it('de -> DE', () => {
    expect(toApiLocale('de')).toBe('DE');
  });
  it('en -> EN', () => {
    expect(toApiLocale('en')).toBe('EN');
  });
  it('fa -> FA', () => {
    expect(toApiLocale('fa')).toBe('FA');
  });
});
