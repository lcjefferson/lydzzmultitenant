import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { ChannelsService } from './channels.service';
import { CreateChannelDto } from './dto/create-channel.dto';
import { UpdateChannelDto } from './dto/update-channel.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';

@Controller('channels')
@UseGuards(JwtAuthGuard)
export class ChannelsController {
  constructor(private readonly channelsService: ChannelsService) {}

  @Post()
  create(@Body() createChannelDto: CreateChannelDto, @GetUser('organizationId') organizationId: string) {
    return this.channelsService.create(createChannelDto, organizationId);
  }

  @Get()
  findAll(@GetUser('organizationId') organizationId: string) {
    return this.channelsService.findAll(organizationId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @GetUser('organizationId') organizationId: string) {
    return this.channelsService.findOne(id, organizationId);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateChannelDto: UpdateChannelDto,
    @GetUser('organizationId') organizationId: string,
  ) {
    return this.channelsService.update(id, updateChannelDto, organizationId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @GetUser('organizationId') organizationId: string) {
    return this.channelsService.remove(id, organizationId);
  }
}
