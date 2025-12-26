import { PartialType } from '@nestjs/mapped-types';
import { CreateConversationDto } from './create-conversation.dto';
import { IsOptional, IsString } from 'class-validator';

export class UpdateConversationDto extends PartialType(CreateConversationDto) {
  @IsOptional()
  @IsString()
  agentId?: string | null;

  @IsOptional()
  @IsString()
  assignedToId?: string | null;
}
