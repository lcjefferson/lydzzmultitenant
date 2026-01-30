import { Test, TestingModule } from '@nestjs/testing';
import { InternalService } from './internal.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConversationsGateway } from '../conversations/conversations.gateway';
import { ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

// Mock do PrismaService
const mockPrismaService = {
  organization: {
    create: jest.fn(),
  },
  user: {
    create: jest.fn(),
    findUnique: jest.fn(),
  },
  channel: {
    findFirst: jest.fn(),
    create: jest.fn(),
  },
  conversation: {
    findMany: jest.fn(),
    create: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  message: {
    findMany: jest.fn(),
    create: jest.fn(),
  },
};

// Mock do ConversationsGateway
const mockConversationsGateway = {
  emitNewMessage: jest.fn(),
};

describe('InternalService', () => {
  let service: InternalService;
  let prisma: typeof mockPrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InternalService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: ConversationsGateway,
          useValue: mockConversationsGateway,
        },
      ],
    }).compile();

    service = module.get<InternalService>(InternalService);
    prisma = module.get(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createOrganizationWithAdmin', () => {
    const createDto = {
      orgName: 'Test Corp',
      userName: 'Admin User',
      userEmail: 'admin@test.com',
      userPassword: 'password123',
    };

    it('should create organization and admin user successfully', async () => {
      // Setup mocks
      const mockOrg = { id: 'org-1', name: 'Test Corp', slug: 'test-corp' };
      const mockUser = { id: 'user-1', email: 'admin@test.com', name: 'Admin User', role: 'admin' };
      const mockChannel = { id: 'channel-1' };

      prisma.organization.create.mockResolvedValue(mockOrg);
      prisma.user.create.mockResolvedValue(mockUser);
      prisma.channel.findFirst.mockResolvedValue(null); // No existing channel
      prisma.channel.create.mockResolvedValue(mockChannel);

      // Execute
      const result = await service.createOrganizationWithAdmin(createDto);

      // Assert
      expect(prisma.organization.create).toHaveBeenCalledWith({
        data: {
          name: createDto.orgName,
          slug: 'test-corp',
          plan: 'starter',
        },
      });

      expect(prisma.user.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          email: createDto.userEmail,
          name: createDto.userName,
          role: 'admin',
          organizationId: mockOrg.id,
        }),
      }));
      
      // Verify password hashing (we can't verify the hash value easily, but we can verify it's not plain text)
      const userCreateCall = prisma.user.create.mock.calls[0][0];
      expect(userCreateCall.data.password).not.toBe(createDto.userPassword);

      expect(prisma.channel.create).toHaveBeenCalled(); // Ensure internal channel is created
      
      expect(result).toEqual({
        organization: mockOrg,
        user: {
            id: mockUser.id,
            email: mockUser.email,
            name: mockUser.name,
            role: mockUser.role,
        }
      });
    });

    it('should throw ConflictException if slug already exists', async () => {
        // Mock Prisma error P2002 for slug
        const error = {
            code: 'P2002',
            meta: { target: ['slug'] },
            message: 'Unique constraint failed on the fields: (`slug`)'
        };
        prisma.organization.create.mockRejectedValue(error);

        await expect(service.createOrganizationWithAdmin(createDto))
            .rejects
            .toThrow(ConflictException);
    });

    it('should throw ConflictException if email already exists', async () => {
        // Org creation success
        const mockOrg = { id: 'org-1', name: 'Test Corp' };
        prisma.organization.create.mockResolvedValue(mockOrg);

        // Mock Prisma error P2002 for email on user creation
        const error = {
            code: 'P2002',
            meta: { target: ['email'] },
            message: 'Unique constraint failed on the fields: (`email`)'
        };
        prisma.user.create.mockRejectedValue(error);

        await expect(service.createOrganizationWithAdmin(createDto))
            .rejects
            .toThrow(ConflictException);
    });
  });
});
