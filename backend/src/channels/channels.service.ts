import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateChannelDto } from './dto/create-channel.dto';
import { UpdateChannelDto } from './dto/update-channel.dto';
import { Channel } from '@prisma/client';

@Injectable()
export class ChannelsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateChannelDto, organizationId: string): Promise<Channel> {
    const provider = dto.provider ?? 'whatsapp-official';
    const baseConfig =
      typeof dto.config === 'object' && dto.config !== null ? dto.config : {};
    const mergedConfig =
      dto.type === 'whatsapp' && provider === 'uazapi'
        ? {
            ...baseConfig,
            instanceId:
              (baseConfig as Record<string, unknown>)?.['instanceId'] ?? '',
            token: (baseConfig as Record<string, unknown>)?.['token'] ?? '',
          }
        : baseConfig;

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
      },
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

  async update(id: string, dto: UpdateChannelDto, organizationId: string): Promise<Channel> {
    const channel = await this.findOne(id, organizationId);
    if (!channel) {
      throw new NotFoundException('Channel not found or access denied');
    }

    if (dto.accessToken) {
        dto.accessToken = dto.accessToken.trim();
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
}
