import { Injectable, Logger, NotFoundException } from '@nestjs/common';
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

  async create(dto: CreateWebhookDto, organizationId: string): Promise<Webhook> {
    const { events, ...rest } = dto;
    return this.prisma.webhook.create({
      data: {
        ...rest,
        events: events.join(','),
        organizationId,
      },
    });
  }

  async findAll(organizationId?: string): Promise<Webhook[]> {
    const where: Prisma.WebhookWhereInput = {};
    if (organizationId) {
      where.organizationId = organizationId;
    }
    return this.prisma.webhook.findMany({ where });
  }

  async findOne(id: string, organizationId?: string): Promise<Webhook | null> {
    const webhook = await this.prisma.webhook.findUnique({ where: { id } });
    if (organizationId && webhook?.organizationId !== organizationId) {
      return null;
    }
    return webhook;
  }

  async update(id: string, dto: UpdateWebhookDto, organizationId?: string): Promise<Webhook> {
    const webhook = await this.findOne(id, organizationId);
    if (!webhook) {
      throw new NotFoundException('Webhook not found');
    }
    
    const { events, ...rest } = dto;
    const data: any = { ...rest };
    if (events) {
      data.events = events.join(',');
    }

    return this.prisma.webhook.update({
      where: { id },
      data,
    });
  }

  async remove(id: string, organizationId?: string): Promise<Webhook> {
    const webhook = await this.findOne(id, organizationId);
    if (!webhook) {
      throw new NotFoundException('Webhook not found');
    }
    return this.prisma.webhook.delete({ where: { id } });
  }

  async triggerWebhook(event: string, payload: Prisma.InputJsonValue, organizationId: string) {
    const webhooks = await this.prisma.webhook.findMany({
      where: {
        isActive: true,
        events: { contains: event },
        organizationId,
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
      payload: payload as any,
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
