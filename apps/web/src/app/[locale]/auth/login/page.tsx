import type { CSSProperties, ReactElement } from 'react';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { LoginForm } from '../../../../components/auth/LoginForm';
import { isValidLocale } from '../../../../i18n/locale-utils';

interface LoginPageProps {
  params: Promise<{ locale: string }>;
}

const HEADING_STYLE: CSSProperties = {
  fontSize: '28px',
  fontWeight: 700,
  color: 'var(--color-text)',
  marginBottom: '8px',
};

const SUBTITLE_STYLE: CSSProperties = {
  fontSize: '15px',
  color: 'var(--color-text-muted)',
  marginBottom: '24px',
};

export default async function LoginPage({ params }: LoginPageProps): Promise<ReactElement> {
  const { locale } = await params;

  if (!isValidLocale(locale)) {
    notFound();
  }

  const t = await getTranslations({ locale, namespace: 'auth.login' });

  return (
    <>
      <h1 style={HEADING_STYLE}>{t('title')}</h1>
      <p style={SUBTITLE_STYLE}>{t('subtitle')}</p>
      <LoginForm locale={locale} />
    </>
  );
}
