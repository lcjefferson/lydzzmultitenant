import { IsString, IsOptional, IsArray, IsNotEmpty, ArrayNotEmpty } from 'class-validator';

export class SendBroadcastDto {
  @IsString()
  @IsNotEmpty()
  channelId: string;

  /** For WhatsApp Official API: template name (from Meta). Omit for Uazapi. */
  @IsOptional()
  @IsString()
  templateName?: string;

  /** For Uazapi or free text: message body. Required when templateName is not set. */
  @IsOptional()
  @IsString()
  message?: string;

  /** List of phone numbers (E.164 or local). Used when leadStatuses is not set. */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  numbers?: string[];

  /** Pipeline statuses to select leads (kanban). Their phones will be used. Used when numbers is not set. */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  leadStatuses?: string[];
}
