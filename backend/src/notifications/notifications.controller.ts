import { Controller, Get, UseGuards, Patch, Param } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async list(
    @GetUser('id') userId: string,
    @GetUser('organizationId') organizationId: string,
  ) {
    return this.notificationsService.listForUser(userId, organizationId);
  }

  @Patch(':id/read')
  async markRead(
    @Param('id') id: string,
    @GetUser('id') userId: string,
    @GetUser('organizationId') organizationId: string,
  ) {
    return this.notificationsService.markRead(id, userId, organizationId);
  }
}
