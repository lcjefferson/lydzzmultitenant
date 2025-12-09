import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAgentDto } from './dto/create-agent.dto';
import { UpdateAgentDto } from './dto/update-agent.dto';
import { Agent } from '@prisma/client';

@Injectable()
export class AgentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateAgentDto): Promise<Agent> {
    const organization = await this.prisma.organization.findFirst();
    if (!organization) {
      throw new Error('No organization found to link agent');
    }

    return this.prisma.agent.create({
      data: {
        ...dto,
        organizationId: organization.id,
      },
    });
  }

  async findAll(): Promise<Agent[]> {
    return this.prisma.agent.findMany();
  }

  async findOne(id: string): Promise<Agent | null> {
    return this.prisma.agent.findUnique({ where: { id } });
  }

  async update(id: string, dto: UpdateAgentDto): Promise<Agent> {
    return this.prisma.agent.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string): Promise<Agent> {
    return this.prisma.agent.delete({ where: { id } });
  }
}
