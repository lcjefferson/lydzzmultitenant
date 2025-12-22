import { Test, TestingModule } from '@nestjs/testing';
import { AnalyticsService } from './analytics.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let prismaService: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        {
          provide: PrismaService,
          useValue: {
            conversation: {
              count: jest.fn(),
              groupBy: jest.fn(),
            },
            lead: {
              count: jest.fn(),
              findMany: jest.fn(),
            },
            message: {
              count: jest.fn(),
            },
            agent: {
              count: jest.fn(),
            },
            user: {
              findMany: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<AnalyticsService>(AnalyticsService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getDashboardMetrics', () => {
    it('should filter metrics by user and organization for consultant', async () => {
      const userId = 'user-1';
      const role = 'user';
      const organizationId = 'org-1';

      await service.getDashboardMetrics(userId, role, organizationId);

      // Verify conversation count filter
      expect(prismaService.conversation.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId,
            OR: [
              { assignedToId: userId },
              { lead: { assignedToId: userId } },
            ],
          }),
        }),
      );

      // Verify lead count filter
      expect(prismaService.lead.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId,
            assignedToId: userId,
            status: { not: 'lost' },
          }),
        }),
      );
    });

    it('should NOT filter metrics by user for admin', async () => {
      const userId = 'admin-1';
      const role = 'admin';
      const organizationId = 'org-1';

      await service.getDashboardMetrics(userId, role, organizationId);

      // Verify conversation count filter (only org)
      expect(prismaService.conversation.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId,
          }),
        }),
      );
      
      // Should not have user filter
      const calls = (prismaService.conversation.count as jest.Mock).mock.calls;
      const args = calls[calls.length - 1][0];
      if (args.where.OR) {
         const hasUserFilter = args.where.OR.some((cond: any) => cond.assignedToId === userId);
         expect(hasUserFilter).toBeFalsy();
      }
    });
  });
});
