'use client';

import { useState, type CSSProperties, type FormEvent, type ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button, Input } from '@contracthero/ui';
import { ApiError } from '../../lib/api/client';
import { useAuth } from '../../lib/auth/auth-context';
import { POST_AUTH_REDIRECT_PATH, REGISTER_PATH } from '../../lib/auth/constants';
import type { Locale } from '../../i18n/locale-utils';

const HTTP_STATUS_UNAUTHORIZED = 401;

export interface LoginFormProps {
  locale: Locale;
  /** Optional path to redirect to after a successful login. */
  redirectTo?: string;
}

interface FormState {
  email: string;
  password: string;
}

const FORM_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '16px',
  width: '100%',
};

const ERROR_STYLE: CSSProperties = {
  color: 'var(--color-error)',
  fontSize: '14px',
  margin: 0,
};

const FOOTER_STYLE: CSSProperties = {
  fontSize: '14px',
  color: 'var(--color-text-muted)',
  marginTop: '8px',
};

const LINK_STYLE: CSSProperties = {
  color: 'var(--color-primary)',
  textDecoration: 'underline',
};

export function LoginForm({ locale, redirectTo }: LoginFormProps): ReactElement {
  const t = useTranslations('auth');
  const tCommon = useTranslations('auth.common');
  const router = useRouter();
  const { login } = useAuth();

  const [form, setForm] = useState<FormState>({ email: '', password: '' });
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const target = redirectTo ?? `/${locale}${POST_AUTH_REDIRECT_PATH}`;
  const registerHref = `/${locale}${REGISTER_PATH}`;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await login({ email: form.email, password: form.password });
      router.push(target);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError && err.status === HTTP_STATUS_UNAUTHORIZED) {
        setError(t('errors.invalidCredentials'));
      } else {
        setError(t('errors.generic'));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form style={FORM_STYLE} onSubmit={handleSubmit} noValidate aria-label={t('login.title')}>
      <Input
        label={tCommon('emailLabel')}
        type="email"
        name="email"
        autoComplete="email"
        required
        value={form.email}
        onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
      />
      <Input
        label={tCommon('passwordLabel')}
        type="password"
        name="password"
        autoComplete="current-password"
        required
        value={form.password}
        onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
      />
      {error !== null && (
        <p style={ERROR_STYLE} role="alert">
          {error}
        </p>
      )}
      <Button type="submit" variant="primary" size="lg" disabled={isSubmitting}>
        {isSubmitting ? tCommon('submitting') : t('login.submit')}
      </Button>
      <p style={FOOTER_STYLE}>
        {t('login.noAccount')}{' '}
        <a href={registerHref} style={LINK_STYLE}>
          {t('login.registerLink')}
        </a>
      </p>
    </form>
  );
}
