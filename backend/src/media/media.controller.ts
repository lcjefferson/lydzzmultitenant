import { Controller, Get, Param, Query, UseGuards, Res } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../auth/guards/tenant.guard';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsAppService } from '../integrations/whatsapp.service';
import type { Response } from 'express';
import axios, { AxiosResponse } from 'axios';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { getConfigPhoneNumberId, getOfficialWhatsAppCredentials } from '../common/channel-credentials.util';

@Controller('media')
@UseGuards(JwtAuthGuard, TenantGuard)
export class MediaController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsappService: WhatsAppService,
  ) {}

  @Get('whatsapp/:mediaId')
  async proxyWhatsAppMedia(
    @Param('mediaId') mediaId: string,
    @Query('phoneNumberId') phoneNumberId: string | undefined,
    @GetUser('organizationId') organizationId: string,
    @Res() res: Response,
  ) {
    const channels = await this.prisma.channel.findMany({
      where: {
        type: 'whatsapp',
        organizationId,
      },
    });

    let channel = phoneNumberId
      ? channels.find((ch) => getConfigPhoneNumberId(ch) === phoneNumberId.trim())
      : undefined;

    if (!channel && phoneNumberId) {
      res.status(404).send('Channel not found for phoneNumberId');
      return;
    }

    if (!channel) {
      channel = channels.find((ch) => {
        const creds = getOfficialWhatsAppCredentials(ch);
        return !!(creds.accessToken && creds.phoneNumberId);
      });
    }

    const { accessToken } = channel
      ? getOfficialWhatsAppCredentials(channel)
      : { accessToken: undefined };

    if (!channel || !accessToken) {
      res.status(404).send('Channel not found or missing access token');
      return;
    }

    try {
      const info = await this.whatsappService.getMediaInfo(mediaId, accessToken);
      const url = info?.url;
      if (!url) {
        res.status(404).send('Media not found');
        return;
      }

      const response: AxiosResponse<NodeJS.ReadableStream> = await axios.get(
        url,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          responseType: 'stream',
        },
      );
      const ct = String(response.headers['content-type'] || '');
      const cl = String(response.headers['content-length'] || '');
      if (ct) {
        res.setHeader('Content-Type', ct);
      }
      if (cl) {
        res.setHeader('Content-Length', cl);
      }
      const stream = response.data;
      stream.pipe(res);
    } catch (error) {
      console.error('Error fetching media:', error);
      res.status(500).send('Error fetching media');
    }
  }
}
