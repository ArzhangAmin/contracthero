import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom';

vi.mock('next-intl', () => ({
  NextIntlClientProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  hasLocale: (locales: string[], locale: string) => locales.includes(locale),
}));

vi.mock('next-intl/server', () => ({
  getMessages: vi.fn().mockResolvedValue({}),
}));

vi.mock('next/navigation', () => ({
  notFound: vi.fn(),
}));

vi.mock('@/i18n/routing', () => ({
  routing: {
    locales: ['de', 'en', 'fa'],
    defaultLocale: 'de',
  },
}));

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
    // Reset html attributes before each test
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

  it('age locale invalid bashad, notFound bayad call beshe', async () => {
    const { notFound } = await import('next/navigation');
    await renderLayout('invalid');
    expect(notFound).toHaveBeenCalled();
  });
});
