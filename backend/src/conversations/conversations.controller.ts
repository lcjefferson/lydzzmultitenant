import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { ConversationsService } from './conversations.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { UpdateConversationDto } from './dto/update-conversation.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';

@Controller('conversations')
@UseGuards(JwtAuthGuard)
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  @Post()
  create(@Body() createConversationDto: CreateConversationDto, @GetUser('organizationId') organizationId: string) {
    return this.conversationsService.create(createConversationDto, organizationId);
  }

  @Get()
  findAll(
    @GetUser() user: { id: string; role: string; organizationId: string },
  ) {
    return this.conversationsService.findAll(
      user?.id,
      user?.role,
      user?.organizationId,
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string, @GetUser('organizationId') organizationId: string) {
    return this.conversationsService.findOne(id, organizationId);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateConversationDto: UpdateConversationDto,
    @GetUser('organizationId') organizationId: string,
  ) {
    return this.conversationsService.update(id, updateConversationDto, organizationId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @GetUser('organizationId') organizationId: string) {
    return this.conversationsService.remove(id, organizationId);
  }
}
