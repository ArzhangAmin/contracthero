/**
 * Auth-related types shared between the API client, AuthProvider, and UI.
 * These mirror the public-safe shapes returned by the NestJS auth controller
 * (see apps/api/src/auth/dto/auth-user.dto.ts).
 */

export type ApiLocale = 'DE' | 'EN' | 'FA';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  locale: ApiLocale;
  createdAt: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  email: string;
  password: string;
  name: string;
  locale?: ApiLocale;
}

export interface AuthResponseBody {
  user: AuthUser;
}
