import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import { RegisterForm } from './RegisterForm';
import { AuthProvider } from '../../lib/auth/auth-context';
import { ApiError } from '../../lib/api/client';
import enMessages from '../../../messages/en.json';
import faMessages from '../../../messages/fa.json';
import type { AuthApi } from '../../lib/api/auth-api';
import type { AuthUser } from '../../lib/auth/types';

const USER: AuthUser = {
  id: 'user_1',
  email: 'user@example.com',
  name: 'Jane',
  locale: 'FA',
  createdAt: new Date('2024-01-01').toISOString(),
};

const pushMock = vi.fn();
const refreshMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
    refresh: refreshMock,
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

function buildApi(overrides: Partial<AuthApi> = {}): AuthApi {
  return {
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    me: vi.fn(),
    ...overrides,
  } as AuthApi;
}

function renderForm(api: AuthApi, locale: 'en' | 'fa' = 'en'): void {
  const messages = locale === 'fa' ? faMessages : enMessages;
  render(
    <NextIntlClientProvider locale={locale} messages={messages}>
      <AuthProvider authApi={api} skipInitialFetch>
        <RegisterForm locale={locale} />
      </AuthProvider>
    </NextIntlClientProvider>,
  );
}

describe('RegisterForm', () => {
  it('register ba locale mapping doroost call mishe', async () => {
    pushMock.mockClear();
    const register = vi.fn().mockResolvedValue(USER);
    renderForm(buildApi({ register }), 'fa');

    fireEvent.change(screen.getByLabelText(faMessages.auth.common.nameLabel), {
      target: { value: 'Jane' },
    });
    fireEvent.change(screen.getByLabelText(faMessages.auth.common.emailLabel), {
      target: { value: USER.email },
    });
    fireEvent.change(screen.getByLabelText(faMessages.auth.common.passwordLabel), {
      target: { value: 'StrongPass1' },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: faMessages.auth.register.submit }));
    });

    await waitFor(() => {
      expect(register).toHaveBeenCalledWith({
        name: 'Jane',
        email: USER.email,
        password: 'StrongPass1',
        locale: 'FA',
      });
    });
    expect(pushMock).toHaveBeenCalledWith('/fa/');
  });

  it('409 -> emailTaken message', async () => {
    const register = vi.fn().mockRejectedValue(new ApiError(409, 'Conflict', null));
    renderForm(buildApi({ register }));

    fireEvent.change(screen.getByLabelText(enMessages.auth.common.nameLabel), {
      target: { value: 'Jane' },
    });
    fireEvent.change(screen.getByLabelText(enMessages.auth.common.emailLabel), {
      target: { value: 'a@b.com' },
    });
    fireEvent.change(screen.getByLabelText(enMessages.auth.common.passwordLabel), {
      target: { value: 'StrongPass1' },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: enMessages.auth.register.submit }));
    });

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(enMessages.auth.errors.emailTaken);
    });
  });

  it('400 -> invalidInput message', async () => {
    const register = vi.fn().mockRejectedValue(new ApiError(400, 'Bad', null));
    renderForm(buildApi({ register }));

    fireEvent.change(screen.getByLabelText(enMessages.auth.common.nameLabel), {
      target: { value: 'Jane' },
    });
    fireEvent.change(screen.getByLabelText(enMessages.auth.common.emailLabel), {
      target: { value: 'a@b.com' },
    });
    fireEvent.change(screen.getByLabelText(enMessages.auth.common.passwordLabel), {
      target: { value: 'bad' },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: enMessages.auth.register.submit }));
    });

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(enMessages.auth.errors.invalidInput);
    });
  });

  it('FA translation ha render mishan', () => {
    renderForm(buildApi(), 'fa');
    expect(screen.getByLabelText(faMessages.auth.common.passwordLabel)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: faMessages.auth.register.submit }),
    ).toBeInTheDocument();
  });

  it('link be login doroost ba locale dare', () => {
    renderForm(buildApi(), 'fa');
    const link = screen.getByRole('link', { name: faMessages.auth.register.loginLink });
    expect(link).toHaveAttribute('href', '/fa/auth/login');
  });
});
