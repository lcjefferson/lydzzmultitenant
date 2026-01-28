import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { LeadsService } from './leads.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';

@Controller('leads')
@UseGuards(JwtAuthGuard)
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  @Post('import')
  importLeads(
    @Body() leads: CreateLeadDto[],
    @GetUser('organizationId') organizationId: string,
  ) {
    return this.leadsService.import(leads, organizationId);
  }

  @Post()
  create(
    @Body() createLeadDto: CreateLeadDto,
    @GetUser('organizationId') organizationId: string,
  ) {
    return this.leadsService.create(createLeadDto, organizationId);
  }

  @Get()
  findAll(
    @Query()
    query: {
      search?: string;
      temperature?: 'hot' | 'warm' | 'cold';
      status?:
        | 'Lead Novo'
        | 'Em Qualificação'
        | 'Qualificado (QUENTE)'
        | 'Reuniões Agendadas'
        | 'Proposta enviada (Follow-up)'
        | 'No Show (Não compareceu) (Follow-up)'
        | 'Contrato fechado';
      source?: string;
    },
    @Req()
    req: Request & {
      user?: { id: string; role: string; organizationId: string };
    },
    @GetUser('organizationId') organizationId: string,
  ) {
    const user = req.user as {
      id: string;
      role: string;
      organizationId: string;
    };
    return this.leadsService.findAll(
      query,
      user?.id,
      user?.role,
      organizationId,
    );
  }

  @Get(':id')
  findOne(
    @Param('id') id: string,
    @GetUser('organizationId') organizationId: string,
  ) {
    return this.leadsService.findOne(id, organizationId);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateLeadDto: UpdateLeadDto,
    @Req() req: Request & { user?: { id: string } },
    @GetUser('organizationId') organizationId: string,
  ) {
    const userId = req.user?.id;
    return this.leadsService.update(id, updateLeadDto, userId, organizationId);
  }

  @Post(':id/delegate')
  delegate(
    @Param('id') id: string,
    @Body() body: { assignedToId: string },
    @Req() req: Request & { user?: { id: string } },
    @GetUser('organizationId') organizationId: string,
  ) {
    const userId = req.user?.id;
    return this.leadsService.delegate(
      id,
      body.assignedToId,
      userId,
      organizationId,
    );
  }

  @Post(':id/tags')
  addTag(
    @Param('id') id: string,
    @Body() body: { tag: string },
    @GetUser('organizationId') organizationId: string,
  ) {
    return this.leadsService.addTag(id, body.tag, organizationId);
  }

  @Delete(':id/tags')
  removeTag(
    @Param('id') id: string,
    @Body() body: { tag: string },
    @GetUser('organizationId') organizationId: string,
  ) {
    return this.leadsService.removeTag(id, body.tag, organizationId);
  }

  @Post(':id/comments')
  addComment(
    @Param('id') id: string,
    @Body() body: { content: string; userId?: string },
    @Req() req: Request & { user?: { id: string } },
    @GetUser('organizationId') organizationId: string,
  ) {
    const userId = req.user?.id || body.userId;
    return this.leadsService.addComment(
      id,
      body.content,
      userId,
      organizationId,
    );
  }

  @Get(':id/comments')
  getComments(
    @Param('id') id: string,
    @GetUser('organizationId') organizationId: string,
  ) {
    return this.leadsService.getComments(id, organizationId);
  }

  @Delete(':id')
  remove(
    @Param('id') id: string,
    @GetUser('organizationId') organizationId: string,
  ) {
    return this.leadsService.remove(id, organizationId);
  }
}
