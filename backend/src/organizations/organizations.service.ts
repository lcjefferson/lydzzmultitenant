import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { Organization, Prisma } from '@prisma/client';
import { EncryptionService } from '../common/encryption.service';

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
      return this.prisma.organization.findMany({ where: { id: organizationId } });
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

    return this.prisma.organization.update({
      where: { id },
      data,
    });
  }

  async remove(id: string): Promise<Organization> {
    return this.prisma.organization.delete({ where: { id } });
  }
}
