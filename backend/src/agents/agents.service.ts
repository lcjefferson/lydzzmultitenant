import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAgentDto } from './dto/create-agent.dto';
import { UpdateAgentDto } from './dto/update-agent.dto';
import { Agent } from '@prisma/client';

@Injectable()
export class AgentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateAgentDto, organizationId: string): Promise<Agent> {
    return this.prisma.agent.create({
      data: {
        ...dto,
        organizationId,
      },
    });
  }

  async findAll(organizationId: string): Promise<Agent[]> {
    return this.prisma.agent.findMany({
      where: { organizationId },
    });
  }

  async findOne(id: string, organizationId: string): Promise<Agent | null> {
    const agent = await this.prisma.agent.findUnique({
      where: { id },
    });

    if (!agent || agent.organizationId !== organizationId) {
      return null;
    }

    return agent;
  }

  async update(id: string, dto: UpdateAgentDto, organizationId: string): Promise<Agent> {
    const agent = await this.findOne(id, organizationId);
    if (!agent) {
      throw new NotFoundException('Agent not found or access denied');
    }

    return this.prisma.agent.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string, organizationId: string): Promise<Agent> {
    const agent = await this.findOne(id, organizationId);
    if (!agent) {
      throw new NotFoundException('Agent not found or access denied');
    }
    
    return this.prisma.agent.delete({ where: { id } });
  }
}
