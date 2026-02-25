import { IsString, IsOptional, IsArray, IsNotEmpty, IsIn } from 'class-validator';

export class SendBroadcastDto {
  @IsString()
  @IsNotEmpty()
  channelId: string;

  /** Campaign name for organization (saved with sent count). */
  @IsOptional()
  @IsString()
  campaignName?: string;

  /** For WhatsApp Official API: template name (from Meta). Omit for Uazapi. */
  @IsOptional()
  @IsString()
  templateName?: string;

  /** For Uazapi or free text: message body (or primary variation). Required when templateName is not set. */
  @IsOptional()
  @IsString()
  message?: string;

  /** Uazapi only: optional 2nd and 3rd message variations; one is picked at random per recipient. */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  messageVariations?: string[];

  /** Uazapi only: message type - text (default), button or list. See Uazapi docs /send/menu. */
  @IsOptional()
  @IsIn(['text', 'button', 'list'])
  messageType?: 'text' | 'button' | 'list';

  /** Uazapi only (button/list): choices. Button: "texto|id" or "texto|url:https://..." or "texto|call:+55...". List: "[Section]" and "item|id|desc". */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  buttonChoices?: string[];

  /** Uazapi only (list): text of the button that opens the list. */
  @IsOptional()
  @IsString()
  listButton?: string;

  /** Uazapi only: optional footer below message (button/list). */
  @IsOptional()
  @IsString()
  footerText?: string;

  /** Uazapi only: optional image URL for button message (imageButton). */
  @IsOptional()
  @IsString()
  imageButtonUrl?: string;

  /** Uazapi only: send media (image/video/audio/document) with optional caption = message. URL must be publicly accessible. */
  @IsOptional()
  @IsString()
  mediaUrl?: string;

  /** Uazapi only: when mediaUrl is set. */
  @IsOptional()
  @IsIn(['image', 'video', 'audio', 'document'])
  mediaType?: 'image' | 'video' | 'audio' | 'document';

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
