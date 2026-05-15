import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Locale } from '@prisma/client';
import { AuthService } from '../auth.service';
import { AUTH_COOKIE_NAME } from '../constants';
import { AuthenticatedUser } from '../types/auth.types';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  const buildConfig = (secret: string | undefined): ConfigService =>
    ({ get: jest.fn().mockReturnValue(secret) }) as unknown as ConfigService;

  const buildAuthService = (
    validate: jest.Mock,
  ): AuthService =>
    ({ validateUserById: validate }) as unknown as AuthService;

  it('throws on construction when JWT_SECRET is missing', () => {
    expect(
      () =>
        new JwtStrategy(
          buildConfig(undefined),
          buildAuthService(jest.fn()),
        ),
    ).toThrow('JWT_SECRET is not configured');
  });

  it('returns the authenticated user via AuthService.validateUserById', async () => {
    const expected: AuthenticatedUser = {
      id: 'user-1',
      email: 'jane@example.com',
      name: 'Jane',
      locale: Locale.DE,
    };
    const validate = jest.fn().mockResolvedValue(expected);

    const strategy = new JwtStrategy(
      buildConfig('test-secret'),
      buildAuthService(validate),
    );

    const result = await strategy.validate(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      {} as any,
      { sub: 'user-1', email: 'jane@example.com' },
    );

    expect(validate).toHaveBeenCalledWith('user-1');
    expect(result).toBe(expected);
  });

  it('throws UnauthorizedException when payload has no sub', async () => {
    const strategy = new JwtStrategy(
      buildConfig('test-secret'),
      buildAuthService(jest.fn()),
    );

    await expect(
      strategy.validate(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        {} as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { email: 'x@y.com' } as any,
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

// Smoke test: ensure constant name is stable (cookie consumers depend on it)
describe('AUTH_COOKIE_NAME', () => {
  it('is exported', () => {
    expect(AUTH_COOKIE_NAME).toBe('auth_token');
  });
});
