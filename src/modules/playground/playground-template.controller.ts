import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Req, ForbiddenException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PlaygroundTemplateService } from './playground-template.service';
import { Request } from 'express';

const ALLOWED_ROLES = ['admin', 'teacher'];

@Controller('playground/admin/templates')
@UseGuards(JwtAuthGuard)
export class PlaygroundTemplateController {
  constructor(private templateService: PlaygroundTemplateService) {}

  private assertAllowed(req: Request) {
    const user = req.user as any;
    if (!ALLOWED_ROLES.includes(user.role?.name?.toLowerCase())) {
      throw new ForbiddenException('Solo administradores o profesores pueden gestionar plantillas.');
    }
  }

  @Get()
  async list(@Req() req: Request, @Query('language') language?: string) {
    this.assertAllowed(req);
    return { data: await this.templateService.list(language) };
  }

  @Get(':id')
  async get(@Req() req: Request, @Param('id') id: string) {
    this.assertAllowed(req);
    return this.templateService.get(id);
  }

  @Post()
  async create(@Req() req: Request, @Body() body: any) {
    this.assertAllowed(req);
    const user = req.user as any;
    return this.templateService.create(user.id, {
      name: body.name,
      description: body.description,
      language: body.language,
      files: body.files ?? [],
    });
  }

  @Patch(':id')
  async update(@Req() req: Request, @Param('id') id: string, @Body() body: any) {
    this.assertAllowed(req);
    return this.templateService.update(id, {
      name: body.name,
      description: body.description,
      language: body.language,
      files: body.files,
    });
  }

  @Delete(':id')
  async remove(@Req() req: Request, @Param('id') id: string) {
    this.assertAllowed(req);
    return this.templateService.remove(id);
  }
}
