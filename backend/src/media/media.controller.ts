import { Controller, Get, Param, Query, UseGuards, Res } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsAppService } from '../integrations/whatsapp.service';
import type { Response } from 'express';
import axios, { AxiosResponse } from 'axios';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { Prisma } from '@prisma/client';

@Controller('media')
@UseGuards(JwtAuthGuard)
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
    const where: Prisma.ChannelWhereInput = {
      type: 'whatsapp',
    };
    if (organizationId) {
      where.organizationId = organizationId;
    }

    const channels = await this.prisma.channel.findMany({
      where,
    });
    
    // Prioritize channel with specific phoneNumberId if provided
    let channel = phoneNumberId 
      ? channels.find(ch => {
          const cfg = typeof ch.config === 'object' && ch.config ? (ch.config as { phoneNumberId?: string }) : undefined;
          return cfg?.phoneNumberId === phoneNumberId;
        })
      : null;

    // If no specific channel found, look for any channel with a valid access token, prioritizing official provider
    if (!channel) {
      // First try to find an official channel with a token
      channel = channels.find(ch => 
        ch.provider === 'whatsapp-official' && ch.accessToken && ch.accessToken.length > 0
      );
      
      // Fallback to any channel with an access token
      if (!channel) {
        channel = channels.find(ch => ch.accessToken && ch.accessToken.length > 0);
      }
      
      // Final fallback to just the first channel (legacy behavior)
      if (!channel) {
        channel = channels[0];
      }
    }

    const accessToken = channel?.accessToken || undefined;
    if (!channel || !accessToken) {
      // Log for debugging
      console.error(`MediaController: No suitable channel found. Org: ${organizationId}, PhoneId: ${phoneNumberId}`);
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
