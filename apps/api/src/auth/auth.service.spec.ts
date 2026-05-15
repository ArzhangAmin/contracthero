import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { Locale, Prisma, User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';
import {
  TOKEN_TYPE_ACCESS,
  TOKEN_TYPE_REFRESH,
} from './constants/auth.constants';
import { JwtPayload } from './types/jwt-payload.type';

jest.mock('bcrypt');

const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

const buildUser = (overrides: Partial<User> = {}): User => ({
  id: 'user-1',
  email: 'jane@example.com',
  passwordHash: 'hashed-password',
  name: 'Jane',
  locale: Locale.DE,
  createdAt: new Date('2024-01-01T00:00:00Z'),
  updatedAt: new Date('2024-01-01T00:00:00Z'),
  ...overrides,
});

describe('AuthService', () => {
  let service: AuthService;
  let usersService: jest.Mocked<UsersService>;
  let jwtService: jest.Mocked<JwtService>;
  let configService: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    const usersMock: Partial<jest.Mocked<UsersService>> = {
      findById: jest.fn(),
      findByEmail: jest.fn(),
      create: jest.fn(),
    };
    const jwtMock: Partial<jest.Mocked<JwtService>> = {
      signAsync: jest.fn(),
      verifyAsync: jest.fn(),
    };
    const configMock: Partial<jest.Mocked<ConfigService>> = {
      get: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersMock },
        { provide: JwtService, useValue: jwtMock },
        { provide: ConfigService, useValue: configMock },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    usersService = module.get(UsersService);
    jwtService = module.get(JwtService);
    configService = module.get(ConfigService);

    // Default: no env overrides
    configService.get.mockReturnValue(undefined);

    // signAsync returns a token tagged by typ for verification in assertions
    jwtService.signAsync.mockImplementation(async (payload: object) => {
      const p = payload as { typ: string };
      return p.typ === TOKEN_TYPE_ACCESS ? 'access-token' : 'refresh-token';
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('hashes password, creates user, and issues an access + refresh token pair', async () => {
      mockedBcrypt.hash.mockResolvedValue('hashed-password' as never);
      const user = buildUser();
      usersService.create.mockResolvedValue(user);

      const result = await service.register({
        email: 'jane@example.com',
        password: 'StrongPass123',
        name: 'Jane',
      });

      expect(mockedBcrypt.hash).toHaveBeenCalledWith('StrongPass123', expect.any(Number));
      expect(usersService.create).toHaveBeenCalledWith({
        email: 'jane@example.com',
        passwordHash: 'hashed-password',
        name: 'Jane',
        locale: undefined,
      });
      expect(jwtService.signAsync).toHaveBeenCalledTimes(2);
      expect(jwtService.signAsync).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          sub: 'user-1',
          email: 'jane@example.com',
          typ: TOKEN_TYPE_ACCESS,
        }),
        expect.objectContaining({ expiresIn: expect.any(String) }),
      );
      expect(jwtService.signAsync).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          sub: 'user-1',
          email: 'jane@example.com',
          typ: TOKEN_TYPE_REFRESH,
        }),
        expect.objectContaining({ expiresIn: expect.any(String) }),
      );
      expect(result.accessToken).toBe('access-token');
      expect(result.refreshToken).toBe('refresh-token');
      expect(result.user).toMatchObject({
        id: 'user-1',
        email: 'jane@example.com',
        name: 'Jane',
        locale: Locale.DE,
      });
    });

    it('throws ConflictException when the email is already registered', async () => {
      mockedBcrypt.hash.mockResolvedValue('hashed-password' as never);
      const prismaError = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed',
        { code: 'P2002', clientVersion: 'test' },
      );
      usersService.create.mockRejectedValue(prismaError);

      await expect(
        service.register({
          email: 'jane@example.com',
          password: 'StrongPass123',
          name: 'Jane',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('re-throws unexpected errors', async () => {
      mockedBcrypt.hash.mockResolvedValue('hashed-password' as never);
      usersService.create.mockRejectedValue(new Error('db down'));

      await expect(
        service.register({
          email: 'jane@example.com',
          password: 'StrongPass123',
          name: 'Jane',
        }),
      ).rejects.toThrow('db down');
    });
  });

  describe('login', () => {
    it('returns a token pair when credentials are valid', async () => {
      const user = buildUser();
      usersService.findByEmail.mockResolvedValue(user);
      mockedBcrypt.compare.mockResolvedValue(true as never);

      const result = await service.login({
        email: 'jane@example.com',
        password: 'StrongPass123',
      });

      expect(usersService.findByEmail).toHaveBeenCalledWith('jane@example.com');
      expect(mockedBcrypt.compare).toHaveBeenCalledWith('StrongPass123', 'hashed-password');
      expect(result.accessToken).toBe('access-token');
      expect(result.refreshToken).toBe('refresh-token');
    });

    it('throws UnauthorizedException when the user does not exist', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      await expect(
        service.login({ email: 'missing@example.com', password: 'StrongPass123' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(mockedBcrypt.compare).not.toHaveBeenCalled();
    });

    it('throws UnauthorizedException when the password does not match', async () => {
      usersService.findByEmail.mockResolvedValue(buildUser());
      mockedBcrypt.compare.mockResolvedValue(false as never);

      await expect(
        service.login({ email: 'jane@example.com', password: 'WrongPass1' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('refresh', () => {
    it('issues a new token pair when refresh token is valid', async () => {
      const payload: JwtPayload = {
        sub: 'user-1',
        email: 'jane@example.com',
        typ: TOKEN_TYPE_REFRESH,
      };
      jwtService.verifyAsync.mockResolvedValue(payload);
      usersService.findById.mockResolvedValue(buildUser());

      const result = await service.refresh('valid-refresh-token');

      expect(jwtService.verifyAsync).toHaveBeenCalledWith('valid-refresh-token');
      expect(result.accessToken).toBe('access-token');
      expect(result.refreshToken).toBe('refresh-token');
    });

    it('rejects an access token used at /refresh', async () => {
      jwtService.verifyAsync.mockResolvedValue({
        sub: 'user-1',
        email: 'jane@example.com',
        typ: TOKEN_TYPE_ACCESS,
      });

      await expect(service.refresh('access-as-refresh')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('rejects an invalid/expired refresh token', async () => {
      jwtService.verifyAsync.mockRejectedValue(new Error('expired'));

      await expect(service.refresh('bad-token')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('rejects when the user no longer exists', async () => {
      jwtService.verifyAsync.mockResolvedValue({
        sub: 'user-1',
        email: 'jane@example.com',
        typ: TOKEN_TYPE_REFRESH,
      });
      usersService.findById.mockResolvedValue(null);

      await expect(service.refresh('valid-refresh-token')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });
  });

  describe('validateAccessUser', () => {
    it('returns the auth user dto for a valid access payload', async () => {
      usersService.findById.mockResolvedValue(buildUser());

      const result = await service.validateAccessUser({
        sub: 'user-1',
        email: 'jane@example.com',
        typ: TOKEN_TYPE_ACCESS,
      });

      expect(result).toMatchObject({
        id: 'user-1',
        email: 'jane@example.com',
        name: 'Jane',
        locale: Locale.DE,
      });
    });

    it('rejects refresh tokens used as access tokens', async () => {
      await expect(
        service.validateAccessUser({
          sub: 'user-1',
          email: 'jane@example.com',
          typ: TOKEN_TYPE_REFRESH,
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects when the user no longer exists', async () => {
      usersService.findById.mockResolvedValue(null);

      await expect(
        service.validateAccessUser({
          sub: 'user-1',
          email: 'jane@example.com',
          typ: TOKEN_TYPE_ACCESS,
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });
});
