import { PartialType } from '@nestjs/mapped-types';
import { CreateOrganizationDto } from './create-organization.dto';
import { IsOptional, IsString, IsNumber, IsObject } from 'class-validator';

export class UpdateOrganizationDto extends PartialType(CreateOrganizationDto) {
  @IsOptional()
  @IsString()
  openaiApiKey?: string;

  @IsOptional()
  @IsString()
  openaiModel?: string;

  @IsOptional()
  @IsNumber()
  openaiMaxTokens?: number;

  @IsOptional()
  @IsNumber()
  openaiTemperature?: number;

  // Mapa: etapa canônica do pipeline -> rótulo personalizado exibido
  @IsOptional()
  @IsObject()
  pipelineStageLabels?: Record<string, string>;
}
