import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { RegisterDto, LoginDto } from './dto/auth.dto';
import { User, Organization } from '@prisma/client';
import { JwtPayload, AuthResponse } from './interfaces/auth.interface';

@Injectable()
export class AuthService {
  private tokenBlacklist: Set<string> = new Set();

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponse> {
    const useMock =
      (this.configService.get<string>('USE_MOCK_AUTH') || 'false') === 'true';
    if (useMock) {
      const user = {
        id: 'mock-admin',
        email: dto.email,
        password: '',
        name: dto.name,
        role: 'admin',
        isActive: true,
        lastLoginAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        organizationId: 'mock-org',
      };
      return this.generateTokens(user as unknown as User);
    }
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new UnauthorizedException('Email already registered');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    let organization: Organization;
    if (dto.organizationName) {
      organization = await this.prisma.organization.create({
        data: {
          name: dto.organizationName,
          slug: dto.organizationName.toLowerCase().replace(/\s+/g, '-'),
        },
      });
    } else {
      const org = await this.prisma.organization.findFirst();
      if (!org) {
        organization = await this.prisma.organization.create({
          data: {
            name: 'Default Organization',
            slug: 'default',
          },
        });
      } else {
        organization = org;
      }
    }

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        password: hashedPassword,
        name: dto.name,
        role: 'admin',
        organizationId: organization.id,
      },
    });

    return this.generateTokens(user);
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    console.log('Login attempt:', JSON.stringify(dto));
    const useMock =
      (this.configService.get<string>('USE_MOCK_AUTH') || 'false') === 'true';
    if (useMock) {
      if (dto.password !== 'senha123') {
        throw new UnauthorizedException('Invalid credentials');
      }
      const user = {
        id: 'mock-admin',
        email: dto.email,
        password: '',
        name: 'Admin User',
        role: 'admin',
        isActive: true,
        lastLoginAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        organizationId: 'mock-org',
      };
      return this.generateTokens(user as unknown as User);
    }
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return this.generateTokens(user);
  }

  async refreshToken(refreshToken: string): Promise<AuthResponse> {
    try {
      const payload = this.jwtService.verify<JwtPayload>(refreshToken, {
        secret:
          this.configService.get<string>('JWT_REFRESH_SECRET') ||
          'refresh-secret',
      });

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });

      if (!user) {
        throw new UnauthorizedException('Invalid token');
      }

      return this.generateTokens(user);
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }

  private generateTokens(user: User): AuthResponse {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      organizationId: user.organizationId,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.jwtService.sign(payload, {
      secret:
        this.configService.get<string>('JWT_REFRESH_SECRET') ||
        'refresh-secret',
      expiresIn: '30d',
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        organizationId: user.organizationId,
      },
    };
  }

  async validateUser(payload: JwtPayload) {
    return this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { organization: true },
    });
  }

  revokeToken(token: string): void {
    if (token) {
      this.tokenBlacklist.add(token);
      // TODO: Migrate to Redis for production
      // await this.redis.set(`blacklist:${token}`, '1', 'EX', 3600);
    }
  }

  isTokenRevoked(token: string): boolean {
    return this.tokenBlacklist.has(token);
    // TODO: Migrate to Redis for production
    // return await this.redis.get(`blacklist:${token}`) !== null;
  }
}
