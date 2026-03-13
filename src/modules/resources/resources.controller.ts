import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Resource, ResourceType } from '../../entities/resource.entity';

class UpsertResourceDto {
  title: string;
  description?: string;
  type?: ResourceType;
  url?: string;
  tags?: string[];
  is_free?: boolean;
  is_published?: boolean;
  order?: number;
}

@Controller('resources')
@UseGuards(JwtAuthGuard)
export class ResourcesAdminController {
  constructor(@InjectRepository(Resource) private repo: Repository<Resource>) {}

  @Get()
  async list(@Query('search') search?: string, @Query('page') page = '1') {
    const where: any = {};
    if (search) where.title = ILike(`%${search}%`);
    const p = Math.max(1, parseInt(page));
    const [data, total] = await this.repo.findAndCount({ where, order: { order: 'ASC', created_at: 'DESC' }, skip: (p - 1) * 20, take: 20 });
    return { data, meta: { total_records: total, page: p, page_size: 20 } };
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    const item = await this.repo.findOne({ where: { id } });
    return item ? { data: item } : { error: 'Not found' };
  }

  @Post()
  async create(@Body() dto: UpsertResourceDto) {
    const item = this.repo.create({ ...dto, type: dto.type || ResourceType.LINK, order: dto.order ?? 0, is_free: dto.is_free ?? true, is_published: dto.is_published ?? false });
    return { data: await this.repo.save(item) };
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: Partial<UpsertResourceDto>) {
    const item = await this.repo.findOne({ where: { id } });
    if (!item) return { error: 'Not found' };
    Object.assign(item, dto);
    return { data: await this.repo.save(item) };
  }

  @Delete(':id')
  async remove(@Param('id') id: string) { await this.repo.delete(id); }
}

@Controller('public/resources')
export class ResourcesPublicController {
  constructor(@InjectRepository(Resource) private repo: Repository<Resource>) {}

  @Get()
  async list(@Query('search') search?: string, @Query('page') page = '1', @Query('page_size') pageSize = '12') {
    const where: any = { is_published: true };
    if (search) where.title = ILike(`%${search}%`);
    const p = Math.max(1, parseInt(page));
    const size = Math.min(50, parseInt(pageSize));
    const [data, total] = await this.repo.findAndCount({ where, order: { order: 'ASC', created_at: 'DESC' }, skip: (p - 1) * size, take: size });
    return { data, meta: { total_records: total, page: p, page_size: size } };
  }
}
