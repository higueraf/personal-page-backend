import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProfileItem, ProfileItemType } from '../../entities/profile-item.entity';

class UpsertProfileItemDto {
  type: ProfileItemType;
  title: string;
  subtitle?: string;
  location?: string;
  start_date?: string;
  end_date?: string;
  description?: string;
  tags?: string[];
  url?: string;
  logo?: string;
  order?: number;
  is_visible?: boolean;
}

@Controller('profile')
@UseGuards(JwtAuthGuard)
export class ProfileAdminController {
  constructor(@InjectRepository(ProfileItem) private repo: Repository<ProfileItem>) {}

  @Get()
  async list(@Query('type') type?: string) {
    const where: any = {};
    if (type) where.type = type;
    const data = await this.repo.find({ where, order: { order: 'ASC', created_at: 'DESC' } });
    return { data };
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    const item = await this.repo.findOne({ where: { id } });
    return item ? { data: item } : { error: 'Not found' };
  }

  @Post()
  async create(@Body() dto: UpsertProfileItemDto) {
    const item = this.repo.create({ ...dto, order: dto.order ?? 0, is_visible: dto.is_visible ?? true });
    return { data: await this.repo.save(item) };
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: Partial<UpsertProfileItemDto>) {
    const item = await this.repo.findOne({ where: { id } });
    if (!item) return { error: 'Not found' };
    Object.assign(item, dto);
    return { data: await this.repo.save(item) };
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.repo.delete(id);
  }
}

@Controller('public/profile')
export class ProfilePublicController {
  constructor(@InjectRepository(ProfileItem) private repo: Repository<ProfileItem>) {}

  @Get()
  async all(@Query('type') type?: string) {
    const where: any = { is_visible: true };
    if (type) where.type = type;
    const data = await this.repo.find({ where, order: { order: 'ASC' } });
    return { data };
  }
}
