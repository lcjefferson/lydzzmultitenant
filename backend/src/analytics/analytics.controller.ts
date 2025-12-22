import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('analytics')
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('dashboard')
  getDashboardMetrics(@Request() req) {
    return this.analyticsService.getDashboardMetrics(
      req.user.id,
      req.user.role,
      req.user.organizationId,
    );
  }

  @Get('conversations')
  getConversationStats() {
    return this.analyticsService.getConversationStats();
  }

  @Get('leads')
  getLeadStats() {
    return this.analyticsService.getLeadStats();
  }

  @Get('reports/contracts')
  getContractsReport() {
    return this.analyticsService.getContractsReport();
  }

  @Get('reports/consultants')
  getConsultantReport() {
    return this.analyticsService.getConsultantReport();
  }
}
