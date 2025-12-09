import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  async cleanDatabase(): Promise<void> {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Cannot clean database in production');
    }

    await this.webhookLog.deleteMany();
    await this.agentWebhook.deleteMany();
    await this.agentChannel.deleteMany();
    await this.message.deleteMany();
    await this.conversation.deleteMany();
    await this.lead.deleteMany();
    await this.channel.deleteMany();
    await this.agent.deleteMany();
    await this.user.deleteMany();
    await this.organization.deleteMany();
    await this.analytics.deleteMany();
  }
}
