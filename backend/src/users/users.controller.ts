import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  Delete,
  UseGuards,
  Query,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { GetUser } from '../auth/decorators/get-user.decorator';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async create(
    @Body() dto: CreateUserDto,
    @GetUser('organizationId') organizationId: string,
  ) {
    return this.usersService.create(dto, organizationId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Get()
  async findAll(@GetUser('organizationId') organizationId: string) {
    return this.usersService.findAll(organizationId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('consultants')
  async findConsultants(@GetUser('organizationId') organizationId: string) {
    return this.usersService.findConsultants(organizationId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('search')
  async search(
    @Query('q') q: string,
    @GetUser('organizationId') organizationId: string,
  ) {
    return this.usersService.search(q, organizationId);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @GetUser('organizationId') organizationId: string,
  ) {
    return this.usersService.findOne(id, organizationId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @GetUser('organizationId') organizationId: string,
  ) {
    return this.usersService.update(id, dto, organizationId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Delete(':id')
  async remove(
    @Param('id') id: string,
    @GetUser('organizationId') organizationId: string,
  ) {
    return this.usersService.remove(id, organizationId);
  }
}
