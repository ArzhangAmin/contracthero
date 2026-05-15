import { Locale } from '@prisma/client';

export interface JwtPayload {
  sub: string;
  email: string;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  locale: Locale;
}

export interface AuthResponse {
  user: AuthenticatedUser;
}
