import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { User, UserStatus } from '../../entities/user.entity';
import { Role } from '../../entities/role.entity';

class UpdateUserDto {
  status?: UserStatus;
  role_id?: string;
  is_active?: boolean;
}

@Controller('admin/users')
@UseGuards(JwtAuthGuard)
export class UsersAdminController {
  constructor(
    @InjectRepository(User) private readonly usersRepo: Repository<User>,
    @InjectRepository(Role) private readonly rolesRepo: Repository<Role>,
  ) {}

  @Get()
  async list(
    @Query('page') page = '1',
    @Query('page_size') pageSize = '20',
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    const p    = Math.max(1, parseInt(page));
    const size = Math.min(100, parseInt(pageSize));

    const qb = this.usersRepo
      .createQueryBuilder('u')
      .leftJoinAndSelect('u.role', 'role')
      .orderBy('u.created_at', 'DESC')
      .skip((p - 1) * size)
      .take(size);

    if (status) qb.andWhere('u.status = :status', { status });
    if (search) {
      qb.andWhere(
        '(u.email ILIKE :q OR u.first_name ILIKE :q OR u.last_name ILIKE :q)',
        { q: `%${search}%` },
      );
    }

    const [users, total] = await qb.getManyAndCount();

    return {
      data: users.map((u) => this.serialize(u)),
      meta: { total_records: total, page: p, page_size: size },
    };
  }

  @Get('roles')
  async roles() {
    const roles = await this.rolesRepo.find({ order: { name: 'ASC' } });
    return { data: roles.map((r) => ({ id: r.id, name: r.name })) };
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    const user = await this.usersRepo.findOne({ where: { id }, relations: ['role'] });
    if (!user) return { error: 'Usuario no encontrado' };

    if (dto.status !== undefined) user.status = dto.status;
    if (dto.is_active !== undefined) user.is_active = dto.is_active;

    if (dto.role_id) {
      const role = await this.rolesRepo.findOne({ where: { id: dto.role_id } });
      if (role) user.role = role;
    }

    const saved = await this.usersRepo.save(user);
    return { data: this.serialize(saved) };
  }

  private serialize(u: User) {
    return {
      id: u.id,
      first_name: u.first_name,
      last_name: u.last_name,
      email: u.email,
      status: u.status,
      is_active: u.is_active,
      role: u.role ? { id: u.role.id, name: u.role.name } : null,
      created_at: u.created_at,
    };
  }
}
