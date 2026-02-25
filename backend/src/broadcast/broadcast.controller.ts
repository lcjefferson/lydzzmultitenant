import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { BroadcastService } from './broadcast.service';
import { SendBroadcastDto } from './dto/send-broadcast.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';

@Controller('broadcast')
@UseGuards(JwtAuthGuard)
export class BroadcastController {
  constructor(private readonly broadcastService: BroadcastService) {}

  @Get('channels')
  getChannels(@GetUser('organizationId') organizationId: string) {
    return this.broadcastService.getChannelsForBroadcast(organizationId);
  }

  @Get('templates')
  getTemplates(
    @Query('channelId') channelId: string,
    @GetUser('organizationId') organizationId: string,
  ) {
    return this.broadcastService.getTemplatesForChannel(channelId, organizationId);
  }

  @Get('lead-statuses')
  getLeadStatuses(@GetUser('organizationId') organizationId: string) {
    return this.broadcastService.getLeadStatuses(organizationId);
  }

  @Get('campaigns')
  getCampaigns(@GetUser('organizationId') organizationId: string) {
    return this.broadcastService.getCampaigns(organizationId);
  }

  @Get('max-daily-recommendation')
  getMaxDailyRecommendation() {
    return this.broadcastService.getMaxDailySendsRecommendation();
  }

  @Get('daily-sent')
  getDailySent(
    @Query('channelId') channelId: string,
    @GetUser('organizationId') organizationId: string,
  ) {
    return this.broadcastService.getDailySentCount(channelId, organizationId);
  }

  @Get('leads')
  getLeadsByStatuses(
    @Query('statuses') statuses: string | string[],
    @GetUser('organizationId') organizationId: string,
  ) {
    const arr = Array.isArray(statuses) ? statuses : statuses ? [statuses] : [];
    return this.broadcastService.getLeadsByStatuses(organizationId, arr);
  }

  @Post('send')
  send(@Body() dto: SendBroadcastDto, @GetUser('organizationId') organizationId: string) {
    return this.broadcastService.send(dto, organizationId);
  }
}
