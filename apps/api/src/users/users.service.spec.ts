import { Test, TestingModule } from '@nestjs/testing';
import { Locale } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { UsersService } from './users.service';

interface PrismaMock {
  user: {
    findUnique: jest.Mock;
    create: jest.Mock;
  };
}

describe('UsersService', () => {
  let service: UsersService;
  let prisma: PrismaMock;

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  describe('findById', () => {
    it('returns the user when present', async () => {
      const user = { id: 'u1', email: 'a@b.com' };
      prisma.user.findUnique.mockResolvedValue(user);

      const result = await service.findById('u1');

      expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { id: 'u1' } });
      expect(result).toBe(user);
    });

    it('returns null when not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      expect(await service.findById('missing')).toBeNull();
    });
  });

  describe('findByEmail', () => {
    it('lowercases the email before lookup', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await service.findByEmail('Foo@Example.COM');

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'foo@example.com' },
      });
    });
  });

  describe('create', () => {
    it('creates a user with normalized email and default locale', async () => {
      const created = { id: 'u1' };
      prisma.user.create.mockResolvedValue(created);

      const result = await service.create({
        email: 'Foo@Example.COM',
        passwordHash: 'hash',
        name: 'Jane',
      });

      expect(prisma.user.create).toHaveBeenCalledWith({
        data: {
          email: 'foo@example.com',
          passwordHash: 'hash',
          name: 'Jane',
          locale: Locale.DE,
        },
      });
      expect(result).toBe(created);
    });

    it('passes through provided locale', async () => {
      prisma.user.create.mockResolvedValue({ id: 'u1' });

      await service.create({
        email: 'a@b.com',
        passwordHash: 'hash',
        name: 'Jane',
        locale: Locale.EN,
      });

      expect(prisma.user.create).toHaveBeenCalledWith({
        data: {
          email: 'a@b.com',
          passwordHash: 'hash',
          name: 'Jane',
          locale: Locale.EN,
        },
      });
    });
  });
});
