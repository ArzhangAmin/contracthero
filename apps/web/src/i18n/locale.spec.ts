import { describe, it, expect } from 'vitest';
import { getLocaleDirection, type Locale } from './locale';

describe('getLocaleDirection', () => {
  it('baraye "de" bayad "ltr" return kone', () => {
    expect(getLocaleDirection('de')).toBe('ltr');
  });

  it('baraye "en" bayad "ltr" return kone', () => {
    expect(getLocaleDirection('en')).toBe('ltr');
  });

  it('baraye "fa" bayad "rtl" return kone', () => {
    expect(getLocaleDirection('fa')).toBe('rtl');
  });

  it('hame locales haye routing bayad direction dashteh bashan', () => {
    const locales: Locale[] = ['de', 'en', 'fa'];
    const validDirections = new Set(['ltr', 'rtl']);

    for (const locale of locales) {
      const dir = getLocaleDirection(locale);
      expect(validDirections.has(dir), `Locale "${locale}" direction "${dir}" valid nist`).toBe(true);
    }
  });
});
