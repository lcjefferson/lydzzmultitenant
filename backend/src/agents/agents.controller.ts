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
import { AgentsService } from './agents.service';
import { CreateAgentDto } from './dto/create-agent.dto';
import { UpdateAgentDto } from './dto/update-agent.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';

@Controller('agents')
@UseGuards(JwtAuthGuard)
export class AgentsController {
  constructor(private readonly agentsService: AgentsService) {}

  @Post()
  create(@Body() createAgentDto: CreateAgentDto, @GetUser('organizationId') organizationId: string) {
    return this.agentsService.create(createAgentDto, organizationId);
  }

  @Get()
  findAll(@GetUser('organizationId') organizationId: string) {
    return this.agentsService.findAll(organizationId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @GetUser('organizationId') organizationId: string) {
    return this.agentsService.findOne(id, organizationId);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateAgentDto: UpdateAgentDto,
    @GetUser('organizationId') organizationId: string,
  ) {
    return this.agentsService.update(id, updateAgentDto, organizationId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @GetUser('organizationId') organizationId: string) {
    return this.agentsService.remove(id, organizationId);
  }
}
