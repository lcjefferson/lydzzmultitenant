import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  Delete,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { OrganizationsService } from './organizations.service';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';

@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(@Body() dto: CreateOrganizationDto) {
    // TODO: Add role check for super admin if needed
    return this.organizationsService.create(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  async findAll(@GetUser('organizationId') organizationId: string) {
    return this.organizationsService.findAll(organizationId);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @GetUser('organizationId') organizationId: string,
  ) {
    if (organizationId && id !== organizationId) {
       // Allow if user is super admin? For now, strict check.
       throw new ForbiddenException('You can only access your own organization');
    }
    return this.organizationsService.findOne(id);
  }

  @UseGuards(JwtAuthGuard)
  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateOrganizationDto,
    @GetUser('organizationId') organizationId: string,
  ) {
    if (organizationId && id !== organizationId) {
      throw new ForbiddenException('You can only update your own organization');
    }
    return this.organizationsService.update(id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async remove(
    @Param('id') id: string,
    @GetUser('organizationId') organizationId: string,
  ) {
    if (organizationId && id !== organizationId) {
      throw new ForbiddenException('You can only delete your own organization');
    }
    return this.organizationsService.remove(id);
  }
}
