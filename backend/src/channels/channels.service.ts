import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateChannelDto } from './dto/create-channel.dto';
import { UpdateChannelDto } from './dto/update-channel.dto';
import { Channel } from '@prisma/client';

@Injectable()
export class ChannelsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateChannelDto): Promise<Channel> {
    let organization = await this.prisma.organization.findFirst();
    if (!organization) {
      organization = await this.prisma.organization.create({
        data: { name: 'Default Organization', slug: 'default' },
      });
    }

    const provider = dto.provider ?? 'whatsapp-official';
    const baseConfig =
      typeof dto.config === 'object' && dto.config !== null ? dto.config : {};
    const mergedConfig =
      dto.type === 'whatsapp' && provider === 'uazapi'
        ? {
            ...baseConfig,
            serverUrl: (baseConfig as Record<string, unknown>)?.['serverUrl'] ?? '',
            instanceToken: (baseConfig as Record<string, unknown>)?.['instanceToken'] ?? '',
            // Keep existing fields for compatibility if needed, or map them
            token: (baseConfig as Record<string, unknown>)?.['instanceToken'] ?? (baseConfig as Record<string, unknown>)?.['token'] ?? '',
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
        organizationId: organization.id,
      },
    });
  }

  async findAll(): Promise<Channel[]> {
    return this.prisma.channel.findMany();
  }

  async findOne(id: string): Promise<Channel | null> {
    return this.prisma.channel.findUnique({ where: { id } });
  }

  async update(id: string, dto: UpdateChannelDto): Promise<Channel> {
    return this.prisma.channel.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string): Promise<Channel> {
    return this.prisma.channel.delete({ where: { id } });
  }
}
