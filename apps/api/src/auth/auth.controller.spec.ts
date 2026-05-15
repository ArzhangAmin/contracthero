import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { Locale } from '@prisma/client';
import type { Request, Response } from 'express';
import { AuthController } from './auth.controller';
import { AuthOutcome, AuthService } from './auth.service';
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
} from './constants/auth.constants';
import { AuthUserDto } from './dto/auth-user.dto';

const buildAuthUser = (): AuthUserDto => ({
  id: 'user-1',
  email: 'jane@example.com',
  name: 'Jane',
  locale: Locale.DE,
  createdAt: new Date('2024-01-01T00:00:00Z'),
});

const buildOutcome = (): AuthOutcome => ({
  user: buildAuthUser(),
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
});

interface ResponseMock {
  cookie: jest.Mock;
  clearCookie: jest.Mock;
}

const buildResponse = (): ResponseMock => ({
  cookie: jest.fn(),
  clearCookie: jest.fn(),
});

describe('AuthController', () => {
  let controller: AuthController;
  let authService: jest.Mocked<AuthService>;
  let configService: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    const authMock: Partial<jest.Mocked<AuthService>> = {
      register: jest.fn(),
      login: jest.fn(),
      refresh: jest.fn(),
    };
    const configMock: Partial<jest.Mocked<ConfigService>> = {
      get: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: authMock },
        { provide: ConfigService, useValue: configMock },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get(AuthService);
    configService = module.get(ConfigService);
  });

  describe('register', () => {
    it('sets access + refresh cookies and returns the user (dev cookies)', async () => {
      authService.register.mockResolvedValue(buildOutcome());
      configService.get.mockReturnValue('development');
      const res = buildResponse();

      const result = await controller.register(
        { email: 'jane@example.com', password: 'StrongPass123', name: 'Jane' },
        res as unknown as Response,
      );

      expect(res.cookie).toHaveBeenCalledWith(
        ACCESS_TOKEN_COOKIE,
        'access-token',
        expect.objectContaining({
          httpOnly: true,
          secure: false,
          sameSite: 'lax',
          path: '/',
          maxAge: expect.any(Number),
        }),
      );
      expect(res.cookie).toHaveBeenCalledWith(
        REFRESH_TOKEN_COOKIE,
        'refresh-token',
        expect.objectContaining({
          httpOnly: true,
          secure: false,
          sameSite: 'lax',
          path: '/',
          maxAge: expect.any(Number),
        }),
      );
      expect(result.user.email).toBe('jane@example.com');
    });

    it('uses secure + strict cookies in production', async () => {
      authService.register.mockResolvedValue(buildOutcome());
      configService.get.mockReturnValue('production');
      const res = buildResponse();

      await controller.register(
        { email: 'jane@example.com', password: 'StrongPass123', name: 'Jane' },
        res as unknown as Response,
      );

      expect(res.cookie).toHaveBeenCalledWith(
        ACCESS_TOKEN_COOKIE,
        'access-token',
        expect.objectContaining({ secure: true, sameSite: 'strict' }),
      );
    });
  });

  describe('login', () => {
    it('sets cookies and returns the user', async () => {
      authService.login.mockResolvedValue(buildOutcome());
      configService.get.mockReturnValue('development');
      const res = buildResponse();

      const result = await controller.login(
        { email: 'jane@example.com', password: 'StrongPass123' },
        res as unknown as Response,
      );

      expect(res.cookie).toHaveBeenCalledTimes(2);
      expect(result.user.email).toBe('jane@example.com');
    });
  });

  describe('refresh', () => {
    it('throws when refresh cookie is missing', async () => {
      const req = { cookies: {} } as unknown as Request;
      const res = buildResponse();

      await expect(
        controller.refresh(req, res as unknown as Response),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('delegates to AuthService.refresh and sets new cookies', async () => {
      authService.refresh.mockResolvedValue(buildOutcome());
      configService.get.mockReturnValue('development');
      const req = {
        cookies: { [REFRESH_TOKEN_COOKIE]: 'some-refresh-token' },
      } as unknown as Request;
      const res = buildResponse();

      const result = await controller.refresh(req, res as unknown as Response);

      expect(authService.refresh).toHaveBeenCalledWith('some-refresh-token');
      expect(res.cookie).toHaveBeenCalledTimes(2);
      expect(result.user.email).toBe('jane@example.com');
    });
  });

  describe('logout', () => {
    it('clears both auth cookies', () => {
      configService.get.mockReturnValue('development');
      const res = buildResponse();

      controller.logout(res as unknown as Response);

      expect(res.clearCookie).toHaveBeenCalledWith(
        ACCESS_TOKEN_COOKIE,
        expect.objectContaining({ httpOnly: true, path: '/' }),
      );
      expect(res.clearCookie).toHaveBeenCalledWith(
        REFRESH_TOKEN_COOKIE,
        expect.objectContaining({ httpOnly: true, path: '/' }),
      );
    });
  });

  describe('me', () => {
    it('returns the current user from the request context', () => {
      const user = buildAuthUser();
      expect(controller.me(user)).toEqual({ user });
    });
  });
});
