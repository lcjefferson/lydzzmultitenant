import { Injectable, Logger } from '@nestjs/common';
import { Channel, Organization, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { getConfigPhoneNumberId } from '../common/channel-credentials.util';

export type ChannelWithOrg = Channel & { organization: Organization };

export type ChannelResolveResult =
  | { channel: ChannelWithOrg; error: null }
  | { channel: null; error: string };

@Injectable()
export class ChannelResolverService {
  private readonly logger = new Logger(ChannelResolverService.name);

  constructor(private readonly prisma: PrismaService) {}

  async resolveOfficialWhatsAppChannel(
    phoneNumberId: string | undefined,
  ): Promise<ChannelResolveResult> {
    if (!phoneNumberId?.trim()) {
      this.logger.error(
        'WhatsApp webhook rejected: payload missing phone_number_id',
      );
      return { channel: null, error: 'missing_phone_number_id' };
    }

    const incomingId = phoneNumberId.trim();
    const channels = await this.prisma.channel.findMany({
      where: { type: 'whatsapp' },
      include: { organization: true },
    });

    const matches = channels.filter((ch) => {
      const configured = getConfigPhoneNumberId(ch);
      return configured === incomingId;
    });

    if (matches.length === 0) {
      this.logger.error(
        `WhatsApp webhook rejected: no channel for phone_number_id=${incomingId}`,
      );
      return { channel: null, error: 'no_match' };
    }

    if (matches.length > 1) {
      this.logger.error(
        `WhatsApp webhook rejected: phone_number_id=${incomingId} matches ${matches.length} channels`,
      );
      return { channel: null, error: 'duplicate_phone_number_id' };
    }

    return { channel: matches[0], error: null };
  }

  async resolveUazapiChannel(
    instanceId: string | undefined,
    headers: Record<string, unknown> | undefined,
  ): Promise<ChannelResolveResult> {
    const channels = await this.prisma.channel.findMany({
      where: { type: { in: ['whatsapp', 'instagram', 'facebook'] } },
      include: { organization: true },
    });

    if (instanceId?.trim()) {
      const normalized = instanceId.trim().toLowerCase();
      const byInstance = channels.find((ch) => {
        const cfg =
          typeof ch.config === 'object' && ch.config
            ? (ch.config as { instanceId?: string })
            : undefined;
        return (
          cfg?.instanceId &&
          cfg.instanceId.toLowerCase() === normalized
        );
      });
      if (byInstance) {
        return { channel: byInstance, error: null };
      }
      this.logger.warn(
        `No Uazapi channel matched instanceId=${instanceId}`,
      );
    }

    if (headers) {
      const raw =
        headers['token'] ??
        headers['apikey'] ??
        headers['authorization'];
      const headerToken =
        typeof raw === 'string' ? raw.replace(/^Bearer\s+/i, '').trim() : '';

      if (headerToken) {
        const byToken = channels.find((ch) => {
          const cfg =
            typeof ch.config === 'object' && ch.config
              ? (ch.config as { token?: string })
              : undefined;
          const token = cfg?.token?.trim();
          return token === headerToken;
        });
        if (byToken) {
          return { channel: byToken, error: null };
        }
      }
    }

    this.logger.error(
      'Uazapi webhook rejected: could not resolve channel (instanceId/token required)',
    );
    return { channel: null, error: 'no_match' };
  }

  async assertUniquePhoneNumberId(
    phoneNumberId: string,
    excludeChannelId?: string,
  ): Promise<void> {
    const trimmed = phoneNumberId.trim();
    if (!trimmed) return;

    const channels = await this.prisma.channel.findMany({
      where: {
        type: 'whatsapp',
        ...(excludeChannelId ? { id: { not: excludeChannelId } } : {}),
      },
      select: { id: true, config: true, organizationId: true },
    });

    const conflict = channels.find(
      (ch) => getConfigPhoneNumberId(ch) === trimmed,
    );
    if (conflict) {
      throw new Error(
        `phone_number_id já está em uso pelo canal ${conflict.id}`,
      );
    }
  }
}
