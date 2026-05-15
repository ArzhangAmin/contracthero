import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { Locale, Prisma, User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';

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

  beforeEach(async () => {
    const usersMock: Partial<jest.Mocked<UsersService>> = {
      findById: jest.fn(),
      findByEmail: jest.fn(),
      create: jest.fn(),
    };
    const jwtMock: Partial<jest.Mocked<JwtService>> = {
      signAsync: jest.fn().mockResolvedValue('signed-jwt'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersMock },
        { provide: JwtService, useValue: jwtMock },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    usersService = module.get(UsersService);
    jwtService = module.get(JwtService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('hashes the password, creates the user and returns a token', async () => {
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
      expect(jwtService.signAsync).toHaveBeenCalledWith({
        sub: 'user-1',
        email: 'jane@example.com',
      });
      expect(result.accessToken).toBe('signed-jwt');
      expect(result.user).toEqual({
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
    it('returns a token when credentials are valid', async () => {
      const user = buildUser();
      usersService.findByEmail.mockResolvedValue(user);
      mockedBcrypt.compare.mockResolvedValue(true as never);

      const result = await service.login({
        email: 'jane@example.com',
        password: 'StrongPass123',
      });

      expect(usersService.findByEmail).toHaveBeenCalledWith('jane@example.com');
      expect(mockedBcrypt.compare).toHaveBeenCalledWith('StrongPass123', 'hashed-password');
      expect(result.accessToken).toBe('signed-jwt');
      expect(result.user.email).toBe('jane@example.com');
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

  describe('validateUserById', () => {
    it('returns the authenticated user shape when found', async () => {
      usersService.findById.mockResolvedValue(buildUser());

      const result = await service.validateUserById('user-1');

      expect(result).toEqual({
        id: 'user-1',
        email: 'jane@example.com',
        name: 'Jane',
        locale: Locale.DE,
      });
    });

    it('throws UnauthorizedException when user is missing', async () => {
      usersService.findById.mockResolvedValue(null);

      await expect(service.validateUserById('user-1')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });
  });
});
