import { routing } from './routing';

export type Locale = (typeof routing.locales)[number];

const RTL_LOCALES: ReadonlySet<Locale> = new Set(['fa']);

export function getLocaleDirection(locale: Locale): 'ltr' | 'rtl' {
  return RTL_LOCALES.has(locale) ? 'rtl' : 'ltr';
}
