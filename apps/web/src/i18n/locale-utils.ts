import { routing } from './routing';

export type Locale = (typeof routing.locales)[number];

const RTL_LOCALES: readonly Locale[] = ['fa'] as const;

export function getLocaleDirection(locale: Locale): 'rtl' | 'ltr' {
  return RTL_LOCALES.includes(locale) ? 'rtl' : 'ltr';
}

export function isValidLocale(value: string): value is Locale {
  return routing.locales.includes(value as Locale);
}
