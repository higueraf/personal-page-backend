import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';

@Controller('admin/users')
@UseGuards(JwtAuthGuard)
export class UsersAdminController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  async list(
    @Query('page') page = '1',
    @Query('page_size') pageSize = '20',
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.usersService.findAll(page, pageSize, status, search);
  }

  @Get('roles')
  async roles() {
    return this.usersService.findRoles();
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.updateUser(id, dto);
  }
}
