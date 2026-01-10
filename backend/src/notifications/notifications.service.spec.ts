import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsService } from './notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConversationsGateway } from '../conversations/conversations.gateway';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let prismaService: PrismaService;
  let gateway: ConversationsGateway;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        {
          provide: PrismaService,
          useValue: {
            notification: {
              create: jest.fn(),
              createMany: jest.fn(),
            },
            user: {
              findMany: jest.fn(),
            },
          },
        },
        {
          provide: ConversationsGateway,
          useValue: {
            emitNotificationCreated: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
    prismaService = module.get<PrismaService>(PrismaService);
    gateway = module.get<ConversationsGateway>(ConversationsGateway);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('notifyOrganization', () => {
    it('should notify all active users in organization except excluded user', async () => {
      const organizationId = 'org-1';
      const excludeUserId = 'user-1';
      const type = 'test_type';
      const entityId = 'entity-1';
      const data = { foo: 'bar' };

      const users = [
        { id: 'user-2' },
        { id: 'user-3' },
      ];

      (prismaService.user.findMany as jest.Mock).mockResolvedValue(users);
      (prismaService.notification.createMany as jest.Mock).mockResolvedValue({ count: 2 });

      await service.notifyOrganization(organizationId, excludeUserId, type, entityId, data);

      expect(prismaService.user.findMany).toHaveBeenCalledWith({
        where: {
          organizationId,
          id: { not: excludeUserId },
          isActive: true,
        },
        select: { id: true },
      });

      expect(prismaService.notification.createMany).toHaveBeenCalledWith({
        data: [
          { type, entityId, userId: 'user-2', organizationId, data },
          { type, entityId, userId: 'user-3', organizationId, data },
        ],
      });

      expect(gateway.emitNotificationCreated).toHaveBeenCalledWith({
        type,
        entityId,
        organizationId,
        targetUserIds: ['user-2', 'user-3'],
      });
    });

    it('should do nothing if no users found', async () => {
      const organizationId = 'org-1';
      const excludeUserId = 'user-1';

      (prismaService.user.findMany as jest.Mock).mockResolvedValue([]);

      await service.notifyOrganization(organizationId, excludeUserId, 'type', 'id', {});

      expect(prismaService.notification.createMany).not.toHaveBeenCalled();
      expect(gateway.emitNotificationCreated).not.toHaveBeenCalled();
    });
  });

  describe('create', () => {
    it('should create a notification and emit an event', async () => {
      const data = {
        type: 'lead_comment_added',
        entityId: 'lead-1',
        userId: 'user-1',
        organizationId: 'org-1',
        data: { comment: 'hello' },
      };

      const createdNotification = {
        id: 'notif-1',
        ...data,
        createdAt: new Date(),
        readAt: null,
      };

      (prismaService.notification.create as jest.Mock).mockResolvedValue(createdNotification);

      const result = await service.create(data);

      expect(prismaService.notification.create).toHaveBeenCalledWith({
        data: {
          type: data.type,
          entityId: data.entityId,
          userId: data.userId,
          organizationId: data.organizationId,
          data: data.data,
        },
      });

      expect(gateway.emitNotificationCreated).toHaveBeenCalledWith(createdNotification);
      expect(result).toEqual(createdNotification);
    });
  });
});
