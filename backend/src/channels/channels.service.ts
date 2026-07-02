import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateChannelDto } from './dto/create-channel.dto';
import { UpdateChannelDto } from './dto/update-channel.dto';
import { Channel } from '@prisma/client';
import { UazapiService } from '../integrations/uazapi.service';
import { getConfigPhoneNumberId } from '../common/channel-credentials.util';

@Injectable()
export class ChannelsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly uazapiService: UazapiService,
  ) {}

  private async ensureUniquePhoneNumberId(
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
    });

    const conflict = channels.find(
      (ch) => getConfigPhoneNumberId(ch) === trimmed,
    );
    if (conflict) {
      throw new ConflictException(
        'Este Phone Number ID já está vinculado a outro canal no sistema',
      );
    }
  }

  async create(
    dto: CreateChannelDto,
    organizationId: string,
  ): Promise<Channel> {
    const provider = dto.provider ?? 'whatsapp-official';
    const baseConfig =
      typeof dto.config === 'object' && dto.config !== null ? dto.config : {};

    // Auto-fetch instanceId for Uazapi if not provided but connection details are present
    if (dto.type === 'whatsapp' && provider === 'uazapi') {
      const configObj = baseConfig;
      const serverUrl = configObj.serverUrl || process.env.UAZAPI_API_URL;
      const token = configObj.token || process.env.UAZAPI_INSTANCE_TOKEN;

      if (serverUrl && token && !configObj.instanceId) {
        try {
          const check = await this.uazapiService.checkConnection(
            token,
            serverUrl,
          );
          if (check.success && check.instanceId) {
            configObj.instanceId = check.instanceId;
            configObj.serverUrl = serverUrl; // Ensure persisted
            configObj.token = token; // Ensure persisted
          }
        } catch (error) {
          // Log but don't block creation, maybe user will fix later
          console.error(
            'Failed to auto-fetch instanceId during creation:',
            error,
          );
        }
      }
    }

    const mergedConfig =
      dto.type === 'whatsapp' && provider === 'uazapi'
        ? {
            ...baseConfig,
            instanceId:
              (baseConfig as Record<string, unknown>)?.['instanceId'] ?? '',
            token: (baseConfig as Record<string, unknown>)?.['token'] ?? '',
          }
        : baseConfig;

    if (dto.type === 'whatsapp' && provider === 'whatsapp-official') {
      const phoneNumberId = String(
        (mergedConfig as Record<string, unknown>)?.phoneNumberId ?? '',
      ).trim();
      if (!phoneNumberId) {
        throw new BadRequestException(
          'Phone Number ID é obrigatório para WhatsApp Oficial',
        );
      }
      await this.ensureUniquePhoneNumberId(phoneNumberId);
    }

    return this.prisma.channel.create({
      data: {
        type: dto.type,
        provider: provider, // Added provider field
        name: dto.name,
        identifier: dto.identifier,
        accessToken: dto.accessToken,
        config: mergedConfig,
        status: dto.status,
        organizationId,
      } as any,
    });
  }

  async findAll(organizationId: string): Promise<Channel[]> {
    return this.prisma.channel.findMany({
      where: { organizationId },
    });
  }

  async findOne(id: string, organizationId: string): Promise<Channel | null> {
    const channel = await this.prisma.channel.findUnique({
      where: { id },
    });

    if (!channel || channel.organizationId !== organizationId) {
      return null;
    }

    return channel;
  }

  async update(
    id: string,
    dto: UpdateChannelDto,
    organizationId: string,
  ): Promise<Channel> {
    const channel = (await this.findOne(id, organizationId)) as any;
    if (!channel) {
      throw new NotFoundException('Channel not found or access denied');
    }

    // Check if config is being updated for Uazapi
    if (dto.config && channel.provider === 'uazapi') {
      const newConfig = dto.config;
      const serverUrl =
        newConfig.serverUrl ||
        channel.config?.serverUrl ||
        process.env.UAZAPI_API_URL;
      const token =
        newConfig.token ||
        channel.config?.token ||
        process.env.UAZAPI_INSTANCE_TOKEN;

      if (serverUrl && token) {
        const check = await this.uazapiService.checkConnection(
          token,
          serverUrl,
        );
        if (!check.success) {
          throw new BadRequestException(
            'Falha ao conectar com Uazapi. Verifique Server URL e Token.',
          );
        }
        if (check.instanceId) {
          newConfig.instanceId = check.instanceId;
        }
        // Ensure critical fields are persisted
        newConfig.serverUrl = serverUrl;
        newConfig.token = token;
      }
    }

    if (dto.accessToken) {
      dto.accessToken = dto.accessToken.trim();
    }

    const mergedForValidation = {
      ...(typeof channel.config === 'object' && channel.config
        ? (channel.config as Record<string, unknown>)
        : {}),
      ...(typeof dto.config === 'object' && dto.config
        ? (dto.config as Record<string, unknown>)
        : {}),
    };
    const nextProvider =
      dto.provider ??
      (channel as { provider?: string }).provider ??
      'whatsapp-official';
    if (channel.type === 'whatsapp' && nextProvider === 'whatsapp-official') {
      const phoneNumberId = String(
        mergedForValidation.phoneNumberId ?? '',
      ).trim();
      if (!phoneNumberId) {
        throw new BadRequestException(
          'Phone Number ID é obrigatório para WhatsApp Oficial',
        );
      }
      await this.ensureUniquePhoneNumberId(phoneNumberId, id);
    }

    return this.prisma.channel.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string, organizationId: string): Promise<Channel> {
    const channel = await this.findOne(id, organizationId);
    if (!channel) {
      throw new NotFoundException('Channel not found or access denied');
    }

    return this.prisma.channel.delete({ where: { id } });
  }

  private getUazapiConnectionParams(channel: Channel): {
    token: string;
    serverUrl?: string;
  } {
    if ((channel as any).provider !== 'uazapi') {
      throw new BadRequestException(
        'Conexão via QR Code disponível apenas para canais Uazapi',
      );
    }
    const config = (channel.config || {}) as Record<string, any>;
    const token = String(
      config.token || process.env.UAZAPI_INSTANCE_TOKEN || '',
    ).trim();
    const serverUrl = String(
      config.serverUrl || process.env.UAZAPI_API_URL || '',
    ).trim();
    if (!token) {
      throw new BadRequestException(
        'Instance Token da Uazapi não configurado para este canal',
      );
    }
    return { token, serverUrl: serverUrl || undefined };
  }

  /** Inicia a conexão da instância Uazapi e retorna o QR Code. */
  async connectUazapi(id: string, organizationId: string) {
    const channel = await this.findOne(id, organizationId);
    if (!channel) {
      throw new NotFoundException('Channel not found or access denied');
    }
    const { token, serverUrl } = this.getUazapiConnectionParams(channel);

    const result = await this.uazapiService.connectInstance(token, serverUrl);
    if (!result.success) {
      throw new BadRequestException(
        `Falha ao iniciar conexão com a Uazapi: ${result.error || 'erro desconhecido'}`,
      );
    }

    if (result.instanceId) {
      await this.prisma.channel.update({
        where: { id },
        data: {
          config: {
            ...((channel.config || {}) as Record<string, any>),
            token,
            ...(serverUrl ? { serverUrl } : {}),
            instanceId: result.instanceId,
          },
        },
      });
    }

    return {
      qrcode: result.qrcode ?? null,
      paircode: result.paircode ?? null,
      status: result.status ?? 'connecting',
    };
  }

  /** Consulta o status da conexão; ao conectar, ativa o canal automaticamente. */
  async getUazapiConnectionStatus(id: string, organizationId: string) {
    const channel = await this.findOne(id, organizationId);
    if (!channel) {
      throw new NotFoundException('Channel not found or access denied');
    }
    const { token, serverUrl } = this.getUazapiConnectionParams(channel);

    const result = await this.uazapiService.getInstanceStatus(token, serverUrl);
    if (!result.success) {
      throw new BadRequestException(
        `Falha ao consultar status na Uazapi: ${result.error || 'erro desconhecido'}`,
      );
    }

    if (result.connected) {
      await this.prisma.channel.update({
        where: { id },
        data: {
          status: 'active',
          lastSyncAt: new Date(),
          config: {
            ...((channel.config || {}) as Record<string, any>),
            token,
            ...(serverUrl ? { serverUrl } : {}),
            ...(result.instanceId ? { instanceId: result.instanceId } : {}),
          },
        },
      });
    }

    return {
      status: result.status ?? 'unknown',
      connected: !!result.connected,
      qrcode: result.qrcode ?? null,
      paircode: result.paircode ?? null,
    };
  }
}
