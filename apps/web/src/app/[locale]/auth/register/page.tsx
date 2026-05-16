import type { CSSProperties, ReactElement } from 'react';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { RegisterForm } from '../../../../components/auth/RegisterForm';
import { isValidLocale } from '../../../../i18n/locale-utils';
import { POST_AUTH_REDIRECT_PATH } from '../../../../lib/auth/constants';
import { resolveRedirectTarget } from '../../../../lib/auth/safe-redirect';

interface RegisterPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
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

function firstParamValue(
  value: string | string[] | undefined,
): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

export default async function RegisterPage({
  params,
  searchParams,
}: RegisterPageProps): Promise<ReactElement> {
  const { locale } = await params;

  if (!isValidLocale(locale)) {
    notFound();
  }

  const resolvedSearchParams = await searchParams;
  const rawRedirect = firstParamValue(resolvedSearchParams.redirect);
  const redirectTo = resolveRedirectTarget(rawRedirect, locale, POST_AUTH_REDIRECT_PATH);

  const t = await getTranslations({ locale, namespace: 'auth.register' });

  return (
    <>
      <h1 style={HEADING_STYLE}>{t('title')}</h1>
      <p style={SUBTITLE_STYLE}>{t('subtitle')}</p>
      <RegisterForm locale={locale} redirectTo={redirectTo} />
    </>
  );
}
