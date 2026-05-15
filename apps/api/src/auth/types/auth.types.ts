/**
 * Barrel that re-exports the canonical auth types from
 * `./jwt-payload.type` plus the auth response wrapper used by controllers.
 */
import { AuthUserDto } from '../dto/auth-user.dto';

export * from './jwt-payload.type';

export interface AuthResponse {
  user: AuthUserDto;
}
