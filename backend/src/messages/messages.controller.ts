import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  UseGuards,
  Query,
} from '@nestjs/common';
import { MessagesService } from './messages.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';

@Controller('messages')
@UseGuards(JwtAuthGuard)
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Post()
  create(
    @Body() createMessageDto: CreateMessageDto,
    @GetUser('organizationId') organizationId: string,
  ) {
    return this.messagesService.create(createMessageDto, organizationId);
  }

  @Get()
  findAll(
    @Query('conversationId') conversationId: string,
    @GetUser('organizationId') organizationId: string,
  ) {
    return this.messagesService.findAll(conversationId, organizationId);
  }

  @Get(':id')
  findOne(
    @Param('id') id: string,
    @GetUser('organizationId') organizationId: string,
  ) {
    return this.messagesService.findOne(id, organizationId);
  }

  @Post(':conversationId/sync')
  syncMessages(
    @Param('conversationId') conversationId: string,
    @GetUser('organizationId') organizationId: string,
  ) {
    return this.messagesService.syncMessages(conversationId, organizationId);
  }

  @Delete(':id')
  remove(
    @Param('id') id: string,
    @GetUser('organizationId') organizationId: string,
  ) {
    return this.messagesService.remove(id, organizationId);
  }
}
