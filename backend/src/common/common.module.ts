import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EncryptionService } from './encryption.service';
import { OpenAIService } from './openai.service';
import { PrismaModule } from '../prisma/prisma.module';

@Global()
@Module({
  imports: [ConfigModule, PrismaModule],
  providers: [EncryptionService, OpenAIService],
  exports: [EncryptionService, OpenAIService],
})
export class CommonModule {}
