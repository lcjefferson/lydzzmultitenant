import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsObject,
  IsIn,
} from 'class-validator';

export class CreateChannelDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(['whatsapp', 'instagram', 'facebook', 'email', 'internal'])
  type: string;

  @IsString()
  @IsOptional()
  @IsIn(['whatsapp-official', 'uazapi'])
  provider?: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  identifier: string;

  @IsString()
  @IsOptional()
  accessToken?: string;

  @IsObject()
  @IsOptional()
  config?: Record<string, any>;

  @IsString()
  @IsOptional()
  @IsIn(['active', 'inactive', 'error'])
  status?: string;
}
