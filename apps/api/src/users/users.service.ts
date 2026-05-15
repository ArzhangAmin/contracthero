import { Injectable } from '@nestjs/common';
import { Locale, User } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';

export interface CreateUserInput {
  email: string;
  passwordHash: string;
  name: string;
  locale?: Locale;
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
  }

  async create(input: CreateUserInput): Promise<User> {
    return this.prisma.user.create({
      data: {
        email: input.email.toLowerCase(),
        passwordHash: input.passwordHash,
        name: input.name,
        locale: input.locale ?? Locale.DE,
      },
    });
  }
}
