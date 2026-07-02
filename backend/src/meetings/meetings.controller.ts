import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
} from '@nestjs/common';
import { MeetingsService } from './meetings.service';
import { CreateMeetingDto } from './dto/create-meeting.dto';
import { UpdateMeetingDto } from './dto/update-meeting.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';

@Controller('meetings')
@UseGuards(JwtAuthGuard)
export class MeetingsController {
  constructor(private readonly meetingsService: MeetingsService) {}

  @Post()
  create(
    @Body() dto: CreateMeetingDto,
    @GetUser('organizationId') organizationId: string,
    @GetUser('id') userId: string,
  ) {
    return this.meetingsService.create(dto, organizationId, userId);
  }

  @Get()
  findAll(
    @GetUser('organizationId') organizationId: string,
    @GetUser('id') userId: string,
    @GetUser('role') role: string,
    @Query('start') start?: string,
    @Query('end') end?: string,
  ) {
    return this.meetingsService.findAll(organizationId, {
      start,
      end,
      userId,
      role,
    });
  }

  @Get(':id')
  findOne(
    @Param('id') id: string,
    @GetUser('organizationId') organizationId: string,
  ) {
    return this.meetingsService.findOne(id, organizationId);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateMeetingDto,
    @GetUser('organizationId') organizationId: string,
  ) {
    return this.meetingsService.update(id, dto, organizationId);
  }

  @Delete(':id')
  remove(
    @Param('id') id: string,
    @GetUser('organizationId') organizationId: string,
  ) {
    return this.meetingsService.remove(id, organizationId);
  }
}
