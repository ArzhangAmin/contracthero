// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom';

vi.mock('next-intl', () => ({
  NextIntlClientProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('next-intl/server', () => ({
  getMessages: vi.fn().mockResolvedValue({}),
}));

vi.mock('next/navigation', () => ({
  notFound: vi.fn(),
}));

vi.mock('@/i18n/locale-utils', () => ({
  isValidLocale: (locale: string) => ['de', 'en', 'fa'].includes(locale),
  getLocaleDirection: (locale: string) => (locale === 'fa' ? 'rtl' : 'ltr'),
}));

vi.mock('@contracthero/ui/styles', () => ({}));

import LocaleLayout from './layout';

async function renderLayout(locale: string) {
  const result = await LocaleLayout({
    children: <div data-testid="child">content</div>,
    params: Promise.resolve({ locale }),
  });
  return render(result as React.ReactElement);
}

describe('LocaleLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.documentElement.removeAttribute('lang');
    document.documentElement.removeAttribute('dir');
  });

  it('baraye locale "de" bayad lang="de" va dir="ltr" set kone', async () => {
    await renderLayout('de');
    expect(document.documentElement.getAttribute('lang')).toBe('de');
    expect(document.documentElement.getAttribute('dir')).toBe('ltr');
  });

  it('baraye locale "en" bayad lang="en" va dir="ltr" set kone', async () => {
    await renderLayout('en');
    expect(document.documentElement.getAttribute('lang')).toBe('en');
    expect(document.documentElement.getAttribute('dir')).toBe('ltr');
  });

  it('baraye locale "fa" bayad lang="fa" va dir="rtl" set kone', async () => {
    await renderLayout('fa');
    expect(document.documentElement.getAttribute('lang')).toBe('fa');
    expect(document.documentElement.getAttribute('dir')).toBe('rtl');
  });

  it('body bayad className "font-vazirmatn" dashteh bashe', async () => {
    await renderLayout('de');
    expect(document.body.className).toContain('font-vazirmatn');
  });

  it('age locale invalid bashad, notFound bayad call beshe', async () => {
    const { notFound } = await import('next/navigation');
    await renderLayout('invalid');
    expect(notFound).toHaveBeenCalled();
  });
});
