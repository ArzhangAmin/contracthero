'use client';

/**
 * AuthProvider — React context that exposes the currently authenticated user
 * and operations (login/register/logout/refresh) to the rest of the app.
 *
 * The provider boots by calling `/auth/me`. While that initial request is
 * in flight, `isLoading` is `true` so route guards can wait before deciding
 * to redirect.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
import { getAuthApi, type AuthApi } from '../api/auth-api';
import type {
  AuthUser,
  LoginPayload,
  RegisterPayload,
} from './types';

export interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (payload: LoginPayload) => Promise<AuthUser>;
  register: (payload: RegisterPayload) => Promise<AuthUser>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export interface AuthProviderProps {
  children: ReactNode;
  /** Initial user (e.g. injected from a server component). */
  initialUser?: AuthUser | null;
  /**
   * Skip the `/auth/me` bootstrap call. Useful when `initialUser` is provided
   * by a server component, or in tests.
   */
  skipInitialFetch?: boolean;
  /** Override the AuthApi implementation (used in tests). */
  authApi?: AuthApi;
}

export function AuthProvider({
  children,
  initialUser = null,
  skipInitialFetch = false,
  authApi,
}: AuthProviderProps): ReactElement {
  const apiRef = useRef<AuthApi>(authApi ?? getAuthApi());
  const [user, setUser] = useState<AuthUser | null>(initialUser);
  const [isLoading, setIsLoading] = useState<boolean>(!skipInitialFetch && initialUser === null);

  const refresh = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    try {
      const current = await apiRef.current.me();
      setUser(current);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (skipInitialFetch || initialUser !== null) {
      return;
    }
    void refresh();
  }, [refresh, skipInitialFetch, initialUser]);

  const login = useCallback(async (payload: LoginPayload): Promise<AuthUser> => {
    const authenticated = await apiRef.current.login(payload);
    setUser(authenticated);
    return authenticated;
  }, []);

  const register = useCallback(async (payload: RegisterPayload): Promise<AuthUser> => {
    const authenticated = await apiRef.current.register(payload);
    setUser(authenticated);
    return authenticated;
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    await apiRef.current.logout();
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      isAuthenticated: user !== null,
      login,
      register,
      logout,
      refresh,
    }),
    [user, isLoading, login, register, logout, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (context === null) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
