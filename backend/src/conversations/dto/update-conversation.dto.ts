import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateConversationDto } from './create-conversation.dto';
import { IsOptional, IsString } from 'class-validator';

export class UpdateConversationDto extends PartialType(OmitType(CreateConversationDto, ['contactTag'])) {
  @IsOptional()
  @IsString()
  agentId?: string | null;

  @IsOptional()
  @IsString()
  assignedToId?: string | null;

  @IsOptional()
  @IsString()
  contactTag?: string | null;
}
