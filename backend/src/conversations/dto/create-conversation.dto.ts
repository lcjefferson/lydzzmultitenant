import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';

export class CreateConversationDto {
  @IsString()
  @IsNotEmpty()
  contactName: string;

  @IsString()
  @IsNotEmpty()
  contactIdentifier: string;

  @IsString()
  @IsNotEmpty()
  channelId: string;

  @IsString()
  @IsOptional()
  @IsEnum(['active', 'waiting', 'closed'])
  status?: string;

  @IsString()
  @IsOptional()
  contactTag?: string;
}
