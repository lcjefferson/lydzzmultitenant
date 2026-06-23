import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { WebhooksService } from './webhooks.service';
import { ChannelResolverService } from './channel-resolver.service';
import { WebhooksController } from './webhooks.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { IntegrationsModule } from '../integrations/integrations.module';
import { ConversationsModule } from '../conversations/conversations.module';
import { MessagesModule } from '../messages/messages.module';

@Module({
  imports: [
    PrismaModule,
    HttpModule,
    IntegrationsModule,
    ConversationsModule,
    MessagesModule,
  ],
  controllers: [WebhooksController],
  providers: [WebhooksService, ChannelResolverService],
  exports: [WebhooksService, ChannelResolverService],
})
export class WebhooksModule {}
