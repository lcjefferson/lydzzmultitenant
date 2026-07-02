import { Injectable, Logger } from '@nestjs/common';
import { Channel, Organization, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  getConfigPhoneNumberId,
  looksLikePhoneNumber,
  normalizeServiceUrl,
} from '../common/channel-credentials.util';

export type ChannelWithOrg = Channel & { organization: Organization };

export type ChannelResolveResult =
  | { channel: ChannelWithOrg; error: null }
  | { channel: null; error: string };

export type UazapiResolveHints = {
  serverUrl?: string;
  token?: string;
};

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
    hints?: UazapiResolveHints,
  ): Promise<ChannelResolveResult> {
    const channels = await this.prisma.channel.findMany({
      where: { type: { in: ['whatsapp', 'instagram', 'facebook'] } },
      include: { organization: true },
    });

    const uazapiChannels = channels.filter((ch) => {
      const provider = (ch as { provider?: string }).provider;
      const cfg =
        typeof ch.config === 'object' && ch.config
          ? (ch.config as {
              provider?: string;
              token?: string;
              instanceId?: string;
            })
          : undefined;
      return (
        provider === 'uazapi' ||
        cfg?.provider === 'uazapi' ||
        Boolean(cfg?.token?.trim())
      );
    });

    const instanceCandidate =
      instanceId?.trim() && !looksLikePhoneNumber(instanceId)
        ? instanceId.trim().toLowerCase()
        : undefined;

    if (instanceCandidate) {
      const byInstance = uazapiChannels.find((ch) => {
        const cfg =
          typeof ch.config === 'object' && ch.config
            ? (ch.config as { instanceId?: string })
            : undefined;
        return (
          cfg?.instanceId && cfg.instanceId.toLowerCase() === instanceCandidate
        );
      });
      if (byInstance) {
        return { channel: byInstance, error: null };
      }
      this.logger.warn(`No Uazapi channel matched instanceId=${instanceId}`);
    } else if (instanceId?.trim() && looksLikePhoneNumber(instanceId)) {
      this.logger.warn(
        `Ignoring phone-like Uazapi instanceId=${instanceId}; trying serverUrl/token`,
      );
    }

    const headerRaw =
      headers?.['token'] ?? headers?.['apikey'] ?? headers?.['authorization'];
    const headerToken =
      typeof headerRaw === 'string'
        ? headerRaw.replace(/^Bearer\s+/i, '').trim()
        : '';
    const tokenToMatch = headerToken || hints?.token?.trim() || '';

    if (tokenToMatch) {
      const byToken = uazapiChannels.find((ch) => {
        const cfg =
          typeof ch.config === 'object' && ch.config
            ? (ch.config as { token?: string })
            : undefined;
        const token = cfg?.token?.trim();
        return token === tokenToMatch;
      });
      if (byToken) {
        return { channel: byToken, error: null };
      }
    }

    const hintUrl = normalizeServiceUrl(hints?.serverUrl);
    if (hintUrl) {
      const byServerUrl = uazapiChannels.filter((ch) => {
        const cfg =
          typeof ch.config === 'object' && ch.config
            ? (ch.config as { serverUrl?: string })
            : undefined;
        const cfgUrl = normalizeServiceUrl(cfg?.serverUrl);
        return cfgUrl === hintUrl;
      });

      if (byServerUrl.length === 1) {
        return { channel: byServerUrl[0], error: null };
      }

      if (byServerUrl.length > 1 && tokenToMatch) {
        const byServerAndToken = byServerUrl.find((ch) => {
          const cfg =
            typeof ch.config === 'object' && ch.config
              ? (ch.config as { token?: string })
              : undefined;
          return cfg?.token?.trim() === tokenToMatch;
        });
        if (byServerAndToken) {
          return { channel: byServerAndToken, error: null };
        }
      }

      if (byServerUrl.length > 1) {
        this.logger.warn(
          `Multiple Uazapi channels share serverUrl=${hints?.serverUrl}; token/instanceId required`,
        );
      }
    }

    this.logger.error(
      'Uazapi webhook rejected: could not resolve channel (instanceId/token/serverUrl required)',
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
