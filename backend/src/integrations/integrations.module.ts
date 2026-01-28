import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { WhatsAppService } from './whatsapp.service';
import { UazapiService } from './uazapi.service';
import { FacebookService } from './facebook.service';

@Module({
  imports: [ConfigModule],
  providers: [WhatsAppService, UazapiService, FacebookService],
  exports: [WhatsAppService, UazapiService, FacebookService],
})
export class IntegrationsModule {}
