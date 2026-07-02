import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OpenAIService } from '../common/openai.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateMeetingDto } from './dto/create-meeting.dto';
import { UpdateMeetingDto } from './dto/update-meeting.dto';

// Etapas do pipeline anteriores a "Reuniões Agendadas" que podem ser promovidas
const PROMOTABLE_LEAD_STATUSES = [
  'Lead Novo',
  'Em Qualificação',
  'Qualificado (QUENTE)',
];

// Sinais de agendamento para evitar chamadas desnecessárias à OpenAI
const MEETING_KEYWORDS =
  /(reuni[ãa]o|agendar|agendad[oa]|marcar|marcamos|marcad[oa]|encontro|call|visita|hor[áa]rio)/i;
const TIME_HINT = /\b\d{1,2}\s*[:h]\s*\d{0,2}\b/i;

@Injectable()
export class MeetingsService {
  private readonly logger = new Logger(MeetingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly openAIService: OpenAIService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(
    dto: CreateMeetingDto,
    organizationId: string,
    createdById?: string,
  ) {
    const meeting = await this.prisma.meeting.create({
      data: {
        title: dto.title,
        notes: dto.notes,
        scheduledAt: new Date(dto.scheduledAt),
        durationMinutes: dto.durationMinutes ?? 30,
        status: dto.status ?? 'scheduled',
        source: 'user',
        contactName: dto.contactName,
        leadId: dto.leadId || null,
        createdById: createdById || null,
        organizationId,
      },
      include: { lead: { select: { id: true, name: true } } },
    });

    await this.promoteLeadStatus(dto.leadId);
    return meeting;
  }

  async findAll(
    organizationId: string,
    opts?: { start?: string; end?: string; userId?: string; role?: string },
  ) {
    const where: Record<string, unknown> = { organizationId };

    if (opts?.start || opts?.end) {
      where.scheduledAt = {
        ...(opts.start ? { gte: new Date(opts.start) } : {}),
        ...(opts.end ? { lte: new Date(opts.end) } : {}),
      };
    }

    // Consultores veem reuniões criadas por eles ou de leads atribuídos a eles
    const role = String(opts?.role || '').toLowerCase();
    if (role && !['admin', 'manager'].includes(role) && opts?.userId) {
      where.OR = [
        { createdById: opts.userId },
        { lead: { assignedToId: opts.userId } },
      ];
    }

    return this.prisma.meeting.findMany({
      where,
      include: {
        lead: { select: { id: true, name: true, phone: true, email: true } },
        createdBy: { select: { id: true, name: true } },
      },
      orderBy: { scheduledAt: 'asc' },
    });
  }

  async findOne(id: string, organizationId: string) {
    const meeting = await this.prisma.meeting.findFirst({
      where: { id, organizationId },
      include: {
        lead: { select: { id: true, name: true, phone: true, email: true } },
        createdBy: { select: { id: true, name: true } },
      },
    });
    if (!meeting) {
      throw new NotFoundException('Meeting not found');
    }
    return meeting;
  }

  async update(id: string, dto: UpdateMeetingDto, organizationId: string) {
    await this.assertAccess(id, organizationId);
    return this.prisma.meeting.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
        ...(dto.scheduledAt !== undefined
          ? { scheduledAt: new Date(dto.scheduledAt) }
          : {}),
        ...(dto.durationMinutes !== undefined
          ? { durationMinutes: dto.durationMinutes }
          : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.leadId !== undefined ? { leadId: dto.leadId || null } : {}),
        ...(dto.contactName !== undefined
          ? { contactName: dto.contactName }
          : {}),
      },
      include: {
        lead: { select: { id: true, name: true, phone: true, email: true } },
        createdBy: { select: { id: true, name: true } },
      },
    });
  }

  async remove(id: string, organizationId: string) {
    await this.assertAccess(id, organizationId);
    return this.prisma.meeting.delete({ where: { id } });
  }

  private async assertAccess(id: string, organizationId: string) {
    const meeting = await this.prisma.meeting.findFirst({
      where: { id, organizationId },
      select: { id: true },
    });
    if (!meeting) {
      throw new NotFoundException('Meeting not found');
    }
  }

  /**
   * Detecção automática: chamada após novas mensagens na conversa.
   * Usa pré-filtro por palavras-chave e extração via OpenAI. Fire-and-forget.
   */
  detectFromConversation(conversationId: string, latestMessage: string) {
    const text = String(latestMessage || '');
    if (!MEETING_KEYWORDS.test(text) && !TIME_HINT.test(text)) {
      return;
    }

    void (async () => {
      try {
        const extraction =
          await this.openAIService.extractMeetingFromConversation(
            conversationId,
          );
        if (!extraction) return;

        const conversation = await this.prisma.conversation.findUnique({
          where: { id: conversationId },
          select: {
            id: true,
            organizationId: true,
            contactName: true,
            contactIdentifier: true,
            leadId: true,
          },
        });
        if (!conversation) return;

        const scheduledAt = new Date(extraction.scheduledAt);

        // Dedup: já existe reunião agendada desta conversa num horário próximo (±2h)?
        const existing = await this.prisma.meeting.findFirst({
          where: {
            conversationId,
            status: 'scheduled',
            scheduledAt: {
              gte: new Date(scheduledAt.getTime() - 2 * 60 * 60 * 1000),
              lte: new Date(scheduledAt.getTime() + 2 * 60 * 60 * 1000),
            },
          },
          select: { id: true },
        });
        if (existing) return;

        const contactName =
          conversation.contactName || conversation.contactIdentifier;

        const meeting = await this.prisma.meeting.create({
          data: {
            title: extraction.title || `Reunião com ${contactName}`,
            scheduledAt,
            status: 'scheduled',
            source: 'ai',
            contactName,
            conversationId,
            leadId: conversation.leadId,
            organizationId: conversation.organizationId,
          },
        });

        this.logger.log(
          `AI detected meeting ${meeting.id} at ${scheduledAt.toISOString()} (conversation ${conversationId})`,
        );

        await this.promoteLeadStatus(conversation.leadId);

        await this.notificationsService.notifyOrganization(
          conversation.organizationId,
          '',
          'meeting_scheduled',
          meeting.id,
          {
            meetingId: meeting.id,
            title: meeting.title,
            scheduledAt: meeting.scheduledAt,
            contactName,
            conversationId,
          },
        );
      } catch (error) {
        this.logger.error(
          `Meeting detection failed for conversation ${conversationId}: ${(error as Error).message}`,
        );
      }
    })();
  }

  /** Move o lead para "Reuniões Agendadas" se ainda estiver em etapa anterior. */
  private async promoteLeadStatus(leadId?: string | null) {
    if (!leadId) return;
    try {
      const lead = await this.prisma.lead.findUnique({
        where: { id: leadId },
        select: { id: true, status: true },
      });
      if (lead && PROMOTABLE_LEAD_STATUSES.includes(lead.status)) {
        await this.prisma.lead.update({
          where: { id: leadId },
          data: { status: 'Reuniões Agendadas' },
        });
      }
    } catch (error) {
      this.logger.warn(
        `Failed to promote lead ${leadId} status: ${(error as Error).message}`,
      );
    }
  }
}
