import type { CSSProperties, ReactElement } from 'react';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { RegisterForm } from '../../../../components/auth/RegisterForm';
import { isValidLocale } from '../../../../i18n/locale-utils';

interface RegisterPageProps {
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

export default async function RegisterPage({
  params,
}: RegisterPageProps): Promise<ReactElement> {
  const { locale } = await params;

  if (!isValidLocale(locale)) {
    notFound();
  }

  const t = await getTranslations({ locale, namespace: 'auth.register' });

  return (
    <>
      <h1 style={HEADING_STYLE}>{t('title')}</h1>
      <p style={SUBTITLE_STYLE}>{t('subtitle')}</p>
      <RegisterForm locale={locale} />
    </>
  );
}
