import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Req,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { InternalService } from './internal.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';
import type { Request } from 'express';
import { ConfigService } from '@nestjs/config';
import { CreateOrganizationDto } from './dto/create-organization.dto';

@Controller('internal')
export class InternalController {
  private readonly logger = new Logger(InternalController.name);

  constructor(
    private readonly internalService: InternalService,
    private readonly configService: ConfigService,
  ) {}

  @Post('onboarding')
  async createOrganizationWithAdmin(@Body() body: CreateOrganizationDto) {
    const masterKeyConfig = this.configService.get<string>('MASTER_SECRET_KEY');
    
    if (!masterKeyConfig) {
      this.logger.error('MASTER_SECRET_KEY is not configured in environment variables');
      throw new UnauthorizedException('System configuration error');
    }

    const inputKey = body.masterKey?.trim();
    const storedKey = masterKeyConfig.trim();

    if (inputKey !== storedKey) {
      this.logger.warn(`Invalid master key attempt`);
      throw new UnauthorizedException('Invalid master key');
    }

    return this.internalService.createOrganizationWithAdmin(body);
  }

  @Get('rooms')
  @UseGuards(JwtAuthGuard)
  listRooms(@GetUser('organizationId') organizationId: string) {
    return this.internalService.listRooms(organizationId);
  }

  @Post('rooms')
  @UseGuards(JwtAuthGuard)
  createRoom(
    @Body() body: { name: string },
    @GetUser('organizationId') organizationId: string,
  ) {
    return this.internalService.createRoom(body.name, organizationId);
  }

  @Get('rooms/:id/messages')
  @UseGuards(JwtAuthGuard)
  getMessages(
    @Param('id') id: string,
    @GetUser('organizationId') organizationId: string,
  ) {
    return this.internalService.getRoomMessages(id, organizationId);
  }

  @Post('rooms/:id/messages')
  @UseGuards(JwtAuthGuard)
  sendMessage(
    @Param('id') id: string,
    @Body() body: { content: string },
    @Req() req: Request & { user?: { id: string } },
    @GetUser('organizationId') organizationId: string,
  ) {
    const userId = req.user?.id as string;
    return this.internalService.sendRoomMessage(id, userId, body.content, organizationId);
  }

  @Get('users')
  @UseGuards(JwtAuthGuard)
  async listUsers(@GetUser('organizationId') organizationId: string) {
    return this.internalService.listUsers(organizationId);
  }

  @Get('dm')
  @UseGuards(JwtAuthGuard)
  listDMs(
    @Req() req: Request & { user?: { id: string } },
    @GetUser('organizationId') organizationId: string,
  ) {
    const userId = req.user?.id as string;
    return this.internalService.listDMs(userId, organizationId);
  }

  @Post('dm')
  @UseGuards(JwtAuthGuard)
  openDM(
    @Body() body: { targetUserId: string },
    @Req() req: Request & { user?: { id: string } },
    @GetUser('organizationId') organizationId: string,
  ) {
    const userId = req.user?.id as string;
    return this.internalService.openDM(userId, body.targetUserId, organizationId);
  }

  @Get('dm/:id/messages')
  @UseGuards(JwtAuthGuard)
  getDMMessages(
    @Param('id') id: string,
    @GetUser('organizationId') organizationId: string,
  ) {
    return this.internalService.getDMMessages(id, organizationId);
  }

  @Post('dm/:id/messages')
  @UseGuards(JwtAuthGuard)
  sendDMMessage(
    @Param('id') id: string,
    @Body() body: { content: string },
    @Req() req: Request & { user?: { id: string } },
    @GetUser('organizationId') organizationId: string,
  ) {
    const userId = req.user?.id as string;
    return this.internalService.sendDMMessage(id, userId, body.content, organizationId);
  }
}
