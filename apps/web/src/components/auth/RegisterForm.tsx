'use client';

import { useState, type CSSProperties, type FormEvent, type ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button, Input } from '@contracthero/ui';
import { ApiError } from '../../lib/api/client';
import { useAuth } from '../../lib/auth/auth-context';
import {
  LOGIN_PATH,
  POST_AUTH_REDIRECT_PATH,
  toApiLocale,
} from '../../lib/auth/constants';
import type { Locale } from '../../i18n/locale-utils';

const HTTP_STATUS_CONFLICT = 409;
const HTTP_STATUS_BAD_REQUEST = 400;

export interface RegisterFormProps {
  locale: Locale;
  /** Optional path to redirect to after a successful registration. */
  redirectTo?: string;
}

interface FormState {
  name: string;
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

export function RegisterForm({ locale, redirectTo }: RegisterFormProps): ReactElement {
  const t = useTranslations('auth');
  const tCommon = useTranslations('auth.common');
  const router = useRouter();
  const { register } = useAuth();

  const [form, setForm] = useState<FormState>({ name: '', email: '', password: '' });
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const target = redirectTo ?? `/${locale}${POST_AUTH_REDIRECT_PATH}`;
  const loginHref = `/${locale}${LOGIN_PATH}`;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await register({
        name: form.name,
        email: form.email,
        password: form.password,
        locale: toApiLocale(locale),
      });
      router.push(target);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === HTTP_STATUS_CONFLICT) {
          setError(t('errors.emailTaken'));
        } else if (err.status === HTTP_STATUS_BAD_REQUEST) {
          setError(t('errors.invalidInput'));
        } else {
          setError(t('errors.generic'));
        }
      } else {
        setError(t('errors.generic'));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form style={FORM_STYLE} onSubmit={handleSubmit} noValidate aria-label={t('register.title')}>
      <Input
        label={tCommon('nameLabel')}
        type="text"
        name="name"
        autoComplete="name"
        required
        value={form.name}
        onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
      />
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
        autoComplete="new-password"
        required
        value={form.password}
        onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
        helperText={t('register.passwordHint')}
      />
      {error !== null && (
        <p style={ERROR_STYLE} role="alert">
          {error}
        </p>
      )}
      <Button type="submit" variant="primary" size="lg" disabled={isSubmitting}>
        {isSubmitting ? tCommon('submitting') : t('register.submit')}
      </Button>
      <p style={FOOTER_STYLE}>
        {t('register.haveAccount')}{' '}
        <a href={loginHref} style={LINK_STYLE}>
          {t('register.loginLink')}
        </a>
      </p>
    </form>
  );
}
