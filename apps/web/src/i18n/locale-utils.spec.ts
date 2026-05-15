import { describe, it, expect } from 'vitest';
import { getLocaleDirection, isValidLocale } from './locale-utils';

describe('getLocaleDirection', () => {
  it('fa locale bayad rtl bargardone', () => {
    expect(getLocaleDirection('fa')).toBe('rtl');
  });

  it('de locale bayad ltr bargardone', () => {
    expect(getLocaleDirection('de')).toBe('ltr');
  });

  it('en locale bayad ltr bargardone', () => {
    expect(getLocaleDirection('en')).toBe('ltr');
  });
});

describe('isValidLocale', () => {
  it('de valid bashe', () => {
    expect(isValidLocale('de')).toBe(true);
  });

  it('en valid bashe', () => {
    expect(isValidLocale('en')).toBe(true);
  });

  it('fa valid bashe', () => {
    expect(isValidLocale('fa')).toBe(true);
  });

  it('fr invalid bashe', () => {
    expect(isValidLocale('fr')).toBe(false);
  });

  it('string khali invalid bashe', () => {
    expect(isValidLocale('')).toBe(false);
  });

  it('unknown locale invalid bashe', () => {
    expect(isValidLocale('xx')).toBe(false);
  });
});
