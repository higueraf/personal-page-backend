import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Project, ProjectStatus } from '../../entities/project.entity';
import { toSlug } from '../../common/slug.util';

class UpsertProjectDto {
  title: string;
  slug?: string;
  description?: string;
  long_description?: string;
  tech_stack?: string[];
  url?: string;
  repo_url?: string;
  thumbnail?: string;
  order?: number;
  status?: ProjectStatus;
}

@Controller('projects')
@UseGuards(JwtAuthGuard)
export class ProjectsAdminController {
  constructor(@InjectRepository(Project) private repo: Repository<Project>) {}

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
    if (!item) return { error: 'Not found' };
    return { data: item };
  }

  @Post()
  async create(@Body() dto: UpsertProjectDto) {
    const item = this.repo.create({ ...dto, slug: dto.slug || toSlug(dto.title), status: dto.status || ProjectStatus.DRAFT, order: dto.order ?? 0 });
    return { data: await this.repo.save(item) };
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: Partial<UpsertProjectDto>) {
    const item = await this.repo.findOne({ where: { id } });
    if (!item) return { error: 'Not found' };
    if (dto.title && !dto.slug) dto.slug = toSlug(dto.title);
    Object.assign(item, dto);
    return { data: await this.repo.save(item) };
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.repo.delete(id);
  }
}

// ── Controlador público ────────────────────────────────────────────────────────

@Controller('public/projects')
export class ProjectsPublicController {
  constructor(@InjectRepository(Project) private repo: Repository<Project>) {}

  @Get()
  async list(@Query('search') search?: string, @Query('page') page = '1', @Query('page_size') pageSize = '12') {
    const where: any = { status: ProjectStatus.PUBLISHED };
    if (search) where.title = ILike(`%${search}%`);
    const p    = Math.max(1, parseInt(page));
    const size = Math.min(50, parseInt(pageSize));
    const [data, total] = await this.repo.findAndCount({ where, order: { order: 'ASC', created_at: 'DESC' }, skip: (p - 1) * size, take: size });
    return { data, meta: { total_records: total, page: p, page_size: size } };
  }

  @Get('featured')
  async featured() {
    const data = await this.repo.find({ where: { status: ProjectStatus.PUBLISHED }, order: { order: 'ASC', created_at: 'DESC' }, take: 3 });
    return { data };
  }

  @Get(':slug')
  async get(@Param('slug') slug: string) {
    const item = await this.repo.findOne({ where: { slug, status: ProjectStatus.PUBLISHED } });
    if (!item) return { error: 'Not found' };
    return { data: item };
  }
}

@Controller('projects')
export class ProjectsModule {}
