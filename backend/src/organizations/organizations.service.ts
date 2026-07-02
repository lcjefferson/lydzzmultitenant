import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { Organization, Prisma } from '@prisma/client';
import { EncryptionService } from '../common/encryption.service';

// Etapas canônicas do pipeline (valores gravados em Lead.status)
export const PIPELINE_STAGES = [
  'Lead Novo',
  'Em Qualificação',
  'Qualificado (QUENTE)',
  'Reuniões Agendadas',
  'Proposta enviada (Follow-up)',
  'No Show (Não compareceu) (Follow-up)',
  'Contrato fechado',
] as const;

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryptionService: EncryptionService,
  ) {}

  async create(dto: CreateOrganizationDto): Promise<Organization> {
    return this.prisma.organization.create({
      data: {
        name: dto.name,
        slug: dto.name.toLowerCase().replace(/\s+/g, '-'),
      },
    });
  }

  async findAll(organizationId?: string): Promise<Organization[]> {
    if (organizationId) {
      return this.prisma.organization.findMany({
        where: { id: organizationId },
      });
    }
    return this.prisma.organization.findMany();
  }

  async findOne(id: string): Promise<Organization | null> {
    return this.prisma.organization.findUnique({ where: { id } });
  }

  async update(id: string, dto: UpdateOrganizationDto): Promise<Organization> {
    const data: Prisma.OrganizationUpdateInput = {};

    if (dto.name) {
      data.name = dto.name;
      data.slug = dto.name.toLowerCase().replace(/\s+/g, '-');
    }

    if (dto.openaiModel) {
      data.openaiModel = dto.openaiModel;
    }

    if (typeof dto.openaiMaxTokens !== 'undefined') {
      data.openaiMaxTokens = dto.openaiMaxTokens;
    }

    if (typeof dto.openaiTemperature !== 'undefined') {
      data.openaiTemperature = dto.openaiTemperature;
    }

    if (
      typeof dto.openaiApiKey === 'string' &&
      dto.openaiApiKey.trim().length > 0
    ) {
      data.openaiApiKey = this.encryptionService.encrypt(
        dto.openaiApiKey.trim(),
      );
    }

    if (typeof dto.pipelineStageLabels !== 'undefined') {
      // Aceita apenas chaves de etapas canônicas e rótulos de texto não vazios
      const sanitized: Record<string, string> = {};
      for (const stage of PIPELINE_STAGES) {
        const label = dto.pipelineStageLabels?.[stage];
        if (
          typeof label === 'string' &&
          label.trim() &&
          label.trim() !== stage
        ) {
          sanitized[stage] = label.trim().slice(0, 60);
        }
      }
      data.pipelineStageLabels = sanitized;
    }

    return this.prisma.organization.update({
      where: { id },
      data,
    });
  }

  async remove(id: string): Promise<Organization> {
    return this.prisma.organization.delete({ where: { id } });
  }
}
