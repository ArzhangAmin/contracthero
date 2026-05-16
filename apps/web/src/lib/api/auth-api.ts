/**
 * Typed wrappers around the auth endpoints exposed by apps/api.
 * All methods rely on cookie-based auth (handled by ApiClient).
 */

import { ApiError, getApiClient, type ApiClient } from './client';
import type {
  AuthResponseBody,
  AuthUser,
  LoginPayload,
  RegisterPayload,
} from '../auth/types';

const PATH_LOGIN = '/auth/login';
const PATH_REGISTER = '/auth/register';
const PATH_LOGOUT = '/auth/logout';
const PATH_ME = '/auth/me';
const HTTP_STATUS_UNAUTHORIZED = 401;

export interface AuthApi {
  login(payload: LoginPayload): Promise<AuthUser>;
  register(payload: RegisterPayload): Promise<AuthUser>;
  logout(): Promise<void>;
  me(): Promise<AuthUser | null>;
}

export class HttpAuthApi implements AuthApi {
  constructor(private readonly client: ApiClient = getApiClient()) {}

  public async login(payload: LoginPayload): Promise<AuthUser> {
    const response = await this.client.request<AuthResponseBody>(PATH_LOGIN, {
      method: 'POST',
      body: payload,
    });
    return response.user;
  }

  public async register(payload: RegisterPayload): Promise<AuthUser> {
    const response = await this.client.request<AuthResponseBody>(PATH_REGISTER, {
      method: 'POST',
      body: payload,
    });
    return response.user;
  }

  public async logout(): Promise<void> {
    await this.client.request<void>(PATH_LOGOUT, { method: 'POST' });
  }

  public async me(): Promise<AuthUser | null> {
    try {
      const response = await this.client.request<AuthResponseBody>(PATH_ME, {
        method: 'GET',
      });
      return response.user;
    } catch (error) {
      if (error instanceof ApiError && error.status === HTTP_STATUS_UNAUTHORIZED) {
        return null;
      }
      throw error;
    }
  }
}

let defaultAuthApi: AuthApi | null = null;

export function getAuthApi(): AuthApi {
  if (!defaultAuthApi) {
    defaultAuthApi = new HttpAuthApi();
  }
  return defaultAuthApi;
}

/** Test-only helper to inject a mock implementation. */
export function __setAuthApiForTesting(api: AuthApi | null): void {
  defaultAuthApi = api;
}
