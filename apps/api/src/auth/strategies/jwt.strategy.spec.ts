import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Locale } from '@prisma/client';
import { AuthService } from '../auth.service';
import { TOKEN_TYPE_ACCESS } from '../constants/auth.constants';
import { AuthUserDto } from '../dto/auth-user.dto';
import { JwtStrategy } from './jwt.strategy';

const buildConfig = (secret: string | undefined): ConfigService =>
  ({ get: jest.fn().mockReturnValue(secret) }) as unknown as ConfigService;

const buildAuthService = (validate: jest.Mock): AuthService =>
  ({ validateAccessUser: validate }) as unknown as AuthService;

describe('JwtStrategy', () => {
  it('throws on construction when JWT_SECRET is missing', () => {
    expect(
      () => new JwtStrategy(buildConfig(undefined), buildAuthService(jest.fn())),
    ).toThrow('JWT_SECRET is not configured');
  });

  it('delegates to AuthService.validateAccessUser for the auth user', async () => {
    const expected: AuthUserDto = {
      id: 'user-1',
      email: 'jane@example.com',
      name: 'Jane',
      locale: Locale.DE,
      createdAt: new Date('2024-01-01T00:00:00Z'),
    };
    const validate = jest.fn().mockResolvedValue(expected);

    const strategy = new JwtStrategy(
      buildConfig('test-secret'),
      buildAuthService(validate),
    );

    const payload = {
      sub: 'user-1',
      email: 'jane@example.com',
      typ: TOKEN_TYPE_ACCESS,
    };

    const result = await strategy.validate(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      {} as any,
      payload,
    );

    expect(validate).toHaveBeenCalledWith(payload);
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
        { email: 'x@y.com', typ: TOKEN_TYPE_ACCESS } as any,
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
