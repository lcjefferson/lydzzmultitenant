import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateAgentDto {
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => value?.trim())
  name: string;

  @IsString()
  @IsOptional()
  @Transform(({ value }) => value?.trim())
  description?: string;

  @IsString()
  @IsOptional()
  @Transform(({ value }) => value?.trim())
  personality?: string;

  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => value?.trim())
  systemMessage: string;

  @IsString()
  @IsOptional()
  model?: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(2)
  temperature?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
