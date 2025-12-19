import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { WhatsAppService } from './whatsapp.service';
import { UazapiService } from './uazapi.service';

@Module({
  imports: [ConfigModule],
  providers: [WhatsAppService, UazapiService],
  exports: [WhatsAppService, UazapiService],
})
export class IntegrationsModule {}
