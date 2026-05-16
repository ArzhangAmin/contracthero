import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import { LoginForm } from './LoginForm';
import { AuthProvider } from '../../lib/auth/auth-context';
import { ApiError } from '../../lib/api/client';
import enMessages from '../../../messages/en.json';
import type { AuthApi } from '../../lib/api/auth-api';
import type { AuthUser } from '../../lib/auth/types';

const USER: AuthUser = {
  id: 'user_1',
  email: 'user@example.com',
  name: 'Jane',
  locale: 'EN',
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

function renderForm(api: AuthApi, redirectTo?: string): void {
  render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <AuthProvider authApi={api} skipInitialFetch>
        <LoginForm locale="en" redirectTo={redirectTo} />
      </AuthProvider>
    </NextIntlClientProvider>,
  );
}

function buildApi(overrides: Partial<AuthApi> = {}): AuthApi {
  return {
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    me: vi.fn(),
    ...overrides,
  } as AuthApi;
}

async function submitWith(email: string, password: string): Promise<void> {
  fireEvent.change(screen.getByLabelText(enMessages.auth.common.emailLabel), {
    target: { value: email },
  });
  fireEvent.change(screen.getByLabelText(enMessages.auth.common.passwordLabel), {
    target: { value: password },
  });
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: enMessages.auth.login.submit }));
  });
}

describe('LoginForm', () => {
  it('translation labels va submit button ro render mikone', () => {
    renderForm(buildApi());
    expect(screen.getByRole('button', { name: enMessages.auth.login.submit })).toBeInTheDocument();
    expect(screen.getByLabelText(enMessages.auth.common.emailLabel)).toBeInTheDocument();
    expect(screen.getByLabelText(enMessages.auth.common.passwordLabel)).toBeInTheDocument();
  });

  it('ba submit movafagh, push be redirect target mikone', async () => {
    pushMock.mockClear();
    refreshMock.mockClear();
    const login = vi.fn().mockResolvedValue(USER);
    renderForm(buildApi({ login }));

    await submitWith(USER.email, 'StrongPass1');

    await waitFor(() => {
      expect(login).toHaveBeenCalledWith({ email: USER.email, password: 'StrongPass1' });
    });
    expect(pushMock).toHaveBeenCalledWith('/en/');
    expect(refreshMock).toHaveBeenCalled();
  });

  it('safe redirectTo prop ro respect mikone', async () => {
    pushMock.mockClear();
    const login = vi.fn().mockResolvedValue(USER);
    renderForm(buildApi({ login }), '/en/dashboard?tab=upcoming');

    await submitWith(USER.email, 'StrongPass1');

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith('/en/dashboard?tab=upcoming');
    });
  });

  it('unsafe redirectTo (cross-origin) ro reject mikone va be /<locale>/ fallback mide', async () => {
    pushMock.mockClear();
    const login = vi.fn().mockResolvedValue(USER);
    renderForm(buildApi({ login }), 'https://evil.example/phish');

    await submitWith(USER.email, 'StrongPass1');

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith('/en/');
    });
    expect(pushMock).not.toHaveBeenCalledWith(expect.stringContaining('evil.example'));
  });

  it('protocol-relative redirectTo (`//evil`) ro reject mikone', async () => {
    pushMock.mockClear();
    const login = vi.fn().mockResolvedValue(USER);
    renderForm(buildApi({ login }), '//evil.example/phish');

    await submitWith(USER.email, 'StrongPass1');

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith('/en/');
    });
  });

  it('401 ro be invalidCredentials message map mikone', async () => {
    const login = vi.fn().mockRejectedValue(new ApiError(401, 'Unauthorized', null));
    renderForm(buildApi({ login }));

    await submitWith('a@b.com', 'xxx');

    await waitFor(() => {
      const alerts = screen.getAllByRole('alert');
      expect(alerts.some((el) => el.textContent === enMessages.auth.errors.invalidCredentials)).toBe(
        true,
      );
    });
  });

  it('error gheyr-ApiError ro generic neshun mide', async () => {
    const login = vi.fn().mockRejectedValue(new Error('network'));
    renderForm(buildApi({ login }));

    await submitWith('a@b.com', 'xxx');

    await waitFor(() => {
      const alerts = screen.getAllByRole('alert');
      expect(alerts.some((el) => el.textContent === enMessages.auth.errors.generic)).toBe(true);
    });
  });

  it('link be safhe register doroost ba locale dare', () => {
    renderForm(buildApi());
    const link = screen.getByRole('link', { name: enMessages.auth.login.registerLink });
    expect(link).toHaveAttribute('href', '/en/auth/register');
  });
});
