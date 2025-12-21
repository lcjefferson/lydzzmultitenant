import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWebhookDto } from './dto/create-webhook.dto';
import { UpdateWebhookDto } from './dto/update-webhook.dto';
import { Webhook, Prisma } from '@prisma/client';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly httpService: HttpService,
  ) {}

  async create(dto: CreateWebhookDto): Promise<Webhook> {
    const organization = await this.prisma.organization.findFirst();
    if (!organization) {
      throw new Error('No organization found to link webhook');
    }

    return this.prisma.webhook.create({
      data: {
        ...dto,
        organizationId: organization.id,
      },
    });
  }

  async findAll(): Promise<Webhook[]> {
    return this.prisma.webhook.findMany();
  }

  async findOne(id: string): Promise<Webhook | null> {
    return this.prisma.webhook.findUnique({ where: { id } });
  }

  async update(id: string, dto: UpdateWebhookDto): Promise<Webhook> {
    return this.prisma.webhook.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string): Promise<Webhook> {
    return this.prisma.webhook.delete({ where: { id } });
  }

  async triggerWebhook(event: string, payload: Prisma.InputJsonValue) {
    const webhooks = await this.prisma.webhook.findMany({
      where: {
        isActive: true,
        events: { has: event },
      },
    });

    await Promise.all(
      webhooks.map((webhook) => this.sendWebhook(webhook, event, payload)),
    );
  }

  async getPublicBaseUrl(): Promise<string | null> {
    const envUrl = process.env.APP_URL || process.env.PUBLIC_URL || process.env.NGROK_URL;
    if (envUrl) {
      return envUrl.replace(/\/$/, '');
    }
    try {
      const res = await firstValueFrom(
        this.httpService.get<{
          tunnels: Array<{ public_url: string; proto: string }>;
        }>('http://127.0.0.1:4040/api/tunnels'),
      );
      const tunnels = res.data?.tunnels ?? [];
      const httpsTunnel =
        tunnels.find((t) => t.proto === 'https') || tunnels[0];
      return httpsTunnel?.public_url ?? null;
    } catch {
      const port = process.env.PORT || 3001;
      return `http://localhost:${port}`;
    }
  }

  async getWhatsAppWebhookUrl(): Promise<string | null> {
    const base = await this.getPublicBaseUrl();
    if (!base) {
      const port = process.env.PORT || 3001;
      return `http://localhost:${port}/api/webhooks/whatsapp`;
    }
    return `${base}/api/webhooks/whatsapp`;
  }

  async getUazapiWebhookUrl(): Promise<string | null> {
    const base = await this.getPublicBaseUrl();
    if (!base) {
      const port = process.env.PORT || 3001;
      return `http://localhost:${port}/api/webhooks/uazapi`;
    }
    return `${base}/api/webhooks/uazapi`;
  }

  private async sendWebhook(
    webhook: Webhook,
    event: string,
    payload: Prisma.InputJsonValue,
  ) {
    const logData: Prisma.WebhookLogUncheckedCreateInput = {
      webhookId: webhook.id,
      event,
      payload,
      success: false,
    };

    try {
      const response = await firstValueFrom(
        this.httpService.post(
          webhook.url,
          { event, payload },
          {
            timeout: webhook.timeout,
            headers: {
              'X-Webhook-Secret': webhook.secret || '',
            },
          },
        ),
      );

      logData.success = true;
      logData.statusCode = response.status;
      logData.response = response.data as unknown as Prisma.InputJsonValue;
    } catch (error) {
      const err = error as { response?: { status?: number }; message?: string };
      logData.success = false;
      logData.statusCode = err.response?.status ?? 500;
      logData.errorMessage = err.message ?? 'unknown error';
      this.logger.error(`Webhook failed: ${logData.errorMessage}`);
    } finally {
      await this.prisma.webhookLog.create({ data: logData });
    }
  }
}
