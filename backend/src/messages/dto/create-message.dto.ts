import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsObject,
  IsNumber,
} from 'class-validator';

export class CreateMessageDto {
  @IsString()
  @IsNotEmpty()
  conversationId: string;

  @IsString()
  @IsOptional()
  @IsEnum(['text', 'image', 'file', 'audio'])
  type?: string;

  @IsString()
  @IsNotEmpty()
  content: string;

  @IsString()
  @IsNotEmpty()
  @IsEnum(['contact', 'ai', 'user'])
  senderType: string;

  @IsNumber()
  @IsOptional()
  confidence?: number;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;

  @IsObject()
  @IsOptional()
  attachments?: Record<string, any>;
}
