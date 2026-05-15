import type { TokenType } from '../constants/auth.constants';

/**
 * JWT payload shape. `sub` is the user id, `typ` distinguishes access vs refresh tokens.
 */
export interface JwtPayload {
  sub: string;
  email: string;
  typ: TokenType;
}

/**
 * The authenticated user shape attached to `req.user` by the JwtStrategy.
 */
export interface AuthenticatedUser {
  id: string;
  email: string;
}
