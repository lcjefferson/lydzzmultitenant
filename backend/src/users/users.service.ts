import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import * as bcrypt from 'bcrypt';
import { User, Prisma } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateUserDto, organizationId: string): Promise<User> {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new BadRequestException('Email already in use');
    }
    const hashed = await bcrypt.hash(dto.password, 10);

    return this.prisma.user.create({
      data: {
        email: dto.email,
        password: hashed,
        name: dto.name,
        role: dto.role ?? 'consultant',
        organizationId,
      },
    });
  }

  async findAll(organizationId?: string): Promise<User[]> {
    const where: Prisma.UserWhereInput = {};
    if (organizationId) {
      where.organizationId = organizationId;
    }
    return this.prisma.user.findMany({ where });
  }

  async findConsultants(organizationId?: string): Promise<User[]> {
    const where: Prisma.UserWhereInput = {
      role: { in: ['consultant', 'vendedor', 'admin', 'manager'] },
      isActive: true,
    };
    if (organizationId) {
      where.organizationId = organizationId;
    }
    return this.prisma.user.findMany({
      where,
      orderBy: { name: 'asc' },
    });
  }

  async search(q: string, organizationId?: string): Promise<User[]> {
    const s = (q || '').trim();
    const where: Prisma.UserWhereInput = {
      isActive: true,
    };
    if (organizationId) {
      where.organizationId = organizationId;
    }
    if (s) {
      where.OR = [
        { name: { contains: s, mode: 'insensitive' } },
        { email: { contains: s, mode: 'insensitive' } },
      ];
    }
    return this.prisma.user.findMany({
      where,
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string, organizationId?: string): Promise<User | null> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (organizationId && user?.organizationId !== organizationId) {
        return null;
    }
    return user;
  }

  async update(id: string, dto: UpdateUserDto, organizationId?: string): Promise<User> {
    if (organizationId) {
        const user = await this.prisma.user.findFirst({ where: { id, organizationId }});
        if (!user) throw new NotFoundException('User not found');
    }

    const data: Prisma.UserUpdateInput = { ...dto };
    if (dto.password) {
      data.password = await bcrypt.hash(dto.password, 10);
    }
    return this.prisma.user.update({ where: { id }, data });
  }

  async remove(id: string, organizationId?: string): Promise<User> {
    if (organizationId) {
        const user = await this.prisma.user.findFirst({ where: { id, organizationId }});
        if (!user) throw new NotFoundException('User not found');
    }
    return this.prisma.user.delete({ where: { id } });
  }
}
