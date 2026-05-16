import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from './auth-context';
import type { AuthApi } from '../api/auth-api';
import type { AuthUser } from './types';

const USER: AuthUser = {
  id: 'user_1',
  email: 'user@example.com',
  name: 'Jane',
  locale: 'DE',
  createdAt: new Date('2024-01-01').toISOString(),
};

function buildAuthApi(overrides: Partial<AuthApi> = {}): AuthApi {
  return {
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    me: vi.fn(),
    ...overrides,
  } as AuthApi;
}

function Consumer(): React.ReactElement {
  const { user, isLoading, isAuthenticated, login, logout } = useAuth();
  return (
    <div>
      <span data-testid="loading">{isLoading ? 'loading' : 'idle'}</span>
      <span data-testid="authed">{isAuthenticated ? 'yes' : 'no'}</span>
      <span data-testid="email">{user?.email ?? ''}</span>
      <button
        type="button"
        onClick={() => {
          void login({ email: USER.email, password: 'pw' });
        }}
      >
        login
      </button>
      <button
        type="button"
        onClick={() => {
          void logout();
        }}
      >
        logout
      </button>
    </div>
  );
}

describe('AuthProvider', () => {
  it('roo mount /auth/me ro seda mizane va user ro set mikone', async () => {
    const api = buildAuthApi({ me: vi.fn().mockResolvedValue(USER) });

    render(
      <AuthProvider authApi={api}>
        <Consumer />
      </AuthProvider>,
    );

    expect(screen.getByTestId('loading')).toHaveTextContent('loading');
    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('idle');
    });
    expect(screen.getByTestId('authed')).toHaveTextContent('yes');
    expect(screen.getByTestId('email')).toHaveTextContent(USER.email);
    expect(api.me).toHaveBeenCalledTimes(1);
  });

  it('age me null bargardune, isAuthenticated false bashe', async () => {
    const api = buildAuthApi({ me: vi.fn().mockResolvedValue(null) });

    render(
      <AuthProvider authApi={api}>
        <Consumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('idle');
    });
    expect(screen.getByTestId('authed')).toHaveTextContent('no');
  });

  it('skipInitialFetch me ro seda nemizane', () => {
    const api = buildAuthApi({ me: vi.fn().mockResolvedValue(null) });

    render(
      <AuthProvider authApi={api} skipInitialFetch>
        <Consumer />
      </AuthProvider>,
    );

    expect(api.me).not.toHaveBeenCalled();
    expect(screen.getByTestId('loading')).toHaveTextContent('idle');
  });

  it('login user ro set mikone', async () => {
    const api = buildAuthApi({
      me: vi.fn().mockResolvedValue(null),
      login: vi.fn().mockResolvedValue(USER),
    });

    render(
      <AuthProvider authApi={api} skipInitialFetch>
        <Consumer />
      </AuthProvider>,
    );

    await act(async () => {
      fireEvent.click(screen.getByText('login'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('authed')).toHaveTextContent('yes');
    });
    expect(screen.getByTestId('email')).toHaveTextContent(USER.email);
    expect(api.login).toHaveBeenCalledWith({ email: USER.email, password: 'pw' });
  });

  it('logout user ro pak mikone', async () => {
    const api = buildAuthApi({
      me: vi.fn().mockResolvedValue(USER),
      logout: vi.fn().mockResolvedValue(undefined),
    });

    render(
      <AuthProvider authApi={api}>
        <Consumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('authed')).toHaveTextContent('yes');
    });

    await act(async () => {
      fireEvent.click(screen.getByText('logout'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('authed')).toHaveTextContent('no');
    });
    expect(api.logout).toHaveBeenCalledTimes(1);
  });

  it('useAuth kharej az Provider error mide', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Consumer />)).toThrow(/AuthProvider/);
    consoleError.mockRestore();
  });
});
