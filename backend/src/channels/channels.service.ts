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

    return this.prisma.channel.create({
      data: {
        ...dto,
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
