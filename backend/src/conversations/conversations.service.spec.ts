import { Test, TestingModule } from '@nestjs/testing';
import { ConversationsService } from './conversations.service';
import { PrismaService } from '../prisma/prisma.service';

describe('ConversationsService', () => {
  let service: ConversationsService;
  let prismaService: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConversationsService,
        {
          provide: PrismaService,
          useValue: {
            conversation: {
              create: jest.fn(),
              findAll: jest.fn(),
              findMany: jest.fn(),
              findUnique: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
            },
            organization: {
              findFirst: jest.fn(),
            },
            lead: {
              findFirst: jest.fn(),
              create: jest.fn(),
            },
            agent: {
              findFirst: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<ConversationsService>(ConversationsService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should filter conversations for consultant user', async () => {
      const userId = 'user-1';
      const role = 'user'; // consultant
      const organizationId = 'org-1';

      await service.findAll(userId, role, organizationId);

      expect(prismaService.conversation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { assignedToId: userId },
              { lead: { assignedToId: userId } },
            ],
          }),
        }),
      );
    });

    it('should NOT filter conversations for admin user', async () => {
      const userId = 'admin-1';
      const role = 'admin';
      const organizationId = 'org-1';

      await service.findAll(userId, role, organizationId);

      const calls = (prismaService.conversation.findMany as jest.Mock).mock.calls;
      const args = calls[calls.length - 1][0]; // last call args
      
      // Check that OR filter with userId is NOT present
      // The current implementation adds channel type filter, so 'where' is not empty.
      // But it should not have the user assignment filter.
      if (args.where.OR) {
          const hasUserFilter = args.where.OR.some((cond: any) => cond.assignedToId === userId);
          expect(hasUserFilter).toBeFalsy();
      } else {
          expect(true).toBeTruthy();
      }
    });
  });
});
