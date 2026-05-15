import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { Locale } from '@prisma/client';
import type { Response } from 'express';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AUTH_COOKIE_NAME } from './constants';
import { AuthenticatedUser } from './types/auth.types';

const buildAuthUser = (): AuthenticatedUser => ({
  id: 'user-1',
  email: 'jane@example.com',
  name: 'Jane',
  locale: Locale.DE,
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
    it('sets the auth cookie and returns the user', async () => {
      const user = buildAuthUser();
      authService.register.mockResolvedValue({ user, accessToken: 'jwt-token' });
      configService.get.mockReturnValue('development');
      const res = buildResponse();

      const result = await controller.register(
        {
          email: 'jane@example.com',
          password: 'StrongPass123',
          name: 'Jane',
        },
        res as unknown as Response,
      );

      expect(authService.register).toHaveBeenCalled();
      expect(res.cookie).toHaveBeenCalledWith(
        AUTH_COOKIE_NAME,
        'jwt-token',
        expect.objectContaining({
          httpOnly: true,
          secure: false,
          sameSite: 'lax',
          path: '/',
        }),
      );
      expect(result).toEqual({ user });
    });

    it('uses secure + strict cookie in production', async () => {
      authService.register.mockResolvedValue({
        user: buildAuthUser(),
        accessToken: 'jwt-token',
      });
      configService.get.mockReturnValue('production');
      const res = buildResponse();

      await controller.register(
        { email: 'jane@example.com', password: 'StrongPass123', name: 'Jane' },
        res as unknown as Response,
      );

      expect(res.cookie).toHaveBeenCalledWith(
        AUTH_COOKIE_NAME,
        'jwt-token',
        expect.objectContaining({ secure: true, sameSite: 'strict' }),
      );
    });
  });

  describe('login', () => {
    it('sets the auth cookie and returns the user', async () => {
      const user = buildAuthUser();
      authService.login.mockResolvedValue({ user, accessToken: 'jwt-token' });
      configService.get.mockReturnValue('development');
      const res = buildResponse();

      const result = await controller.login(
        { email: 'jane@example.com', password: 'StrongPass123' },
        res as unknown as Response,
      );

      expect(authService.login).toHaveBeenCalled();
      expect(res.cookie).toHaveBeenCalledWith(
        AUTH_COOKIE_NAME,
        'jwt-token',
        expect.any(Object),
      );
      expect(result).toEqual({ user });
    });
  });

  describe('logout', () => {
    it('clears the auth cookie', () => {
      configService.get.mockReturnValue('development');
      const res = buildResponse();

      controller.logout(res as unknown as Response);

      expect(res.clearCookie).toHaveBeenCalledWith(
        AUTH_COOKIE_NAME,
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
