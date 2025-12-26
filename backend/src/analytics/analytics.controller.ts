import { Controller, Get, UseGuards } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';

@Controller('analytics')
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('dashboard')
  getDashboardMetrics(
    @GetUser('id') userId: string,
    @GetUser('role') role: string,
    @GetUser('organizationId') organizationId: string,
  ) {
    return this.analyticsService.getDashboardMetrics(
      userId,
      role,
      organizationId,
    );
  }

  @Get('conversations')
  getConversationStats(
    @GetUser('id') userId: string,
    @GetUser('role') role: string,
    @GetUser('organizationId') organizationId: string,
  ) {
    return this.analyticsService.getConversationStats(
      userId,
      role,
      organizationId,
    );
  }

  @Get('leads')
  getLeadStats(@GetUser('organizationId') organizationId: string) {
    return this.analyticsService.getLeadStats(organizationId);
  }

  @Get('reports/contracts')
  getContractsReport(@GetUser('organizationId') organizationId: string) {
    return this.analyticsService.getContractsReport(organizationId);
  }

  @Get('reports/consultants')
  getConsultantReport(@GetUser('organizationId') organizationId: string) {
    return this.analyticsService.getConsultantReport(organizationId);
  }
}
