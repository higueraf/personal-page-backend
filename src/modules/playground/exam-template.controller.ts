import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Req, ForbiddenException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ExamTemplateService } from './exam-template.service';
import { PracticeApiService } from '../practice-api/practice-api.service';
import { TodoApiService } from '../todo-api/todo-api.service';
import { Request } from 'express';

const ALLOWED_ROLES = ['admin', 'teacher'];

@Controller('playground/admin/exam-templates')
@UseGuards(JwtAuthGuard)
export class ExamTemplateController {
  constructor(
    private examTemplateService: ExamTemplateService,
    private practiceApiService: PracticeApiService,
    private todoApiService: TodoApiService,
  ) {}

  private assertAllowed(req: Request) {
    const user = req.user as any;
    if (!ALLOWED_ROLES.includes(user.role?.name?.toLowerCase())) {
      throw new ForbiddenException('Solo administradores o profesores pueden gestionar exámenes.');
    }
  }

  @Get()
  async list(@Req() req: Request) {
    this.assertAllowed(req);
    return { data: await this.examTemplateService.list() };
  }

  @Get(':id')
  async get(@Req() req: Request, @Param('id') id: string) {
    this.assertAllowed(req);
    return this.examTemplateService.get(id);
  }

  @Post()
  async create(@Req() req: Request, @Body() body: any) {
    this.assertAllowed(req);
    const user = req.user as any;
    return this.examTemplateService.create(user.id, {
      name: body.name,
      description: body.description,
      language: body.language ?? 'typescript',
      versions: body.versions ?? [],
    });
  }

  @Patch(':id')
  async update(@Req() req: Request, @Param('id') id: string, @Body() body: any) {
    this.assertAllowed(req);
    return this.examTemplateService.update(id, {
      name: body.name,
      description: body.description,
      language: body.language,
      versions: body.versions,
    });
  }

  @Delete(':id')
  async remove(@Req() req: Request, @Param('id') id: string) {
    this.assertAllowed(req);
    return this.examTemplateService.remove(id);
  }

  /**
   * Restablece a sus valores semilla las tablas compartidas que usan los
   * exámenes con CRUD real contra un backend (To-Do y todas las variantes
   * de practice-api). Estas tablas son globales entre todos los estudiantes,
   * así que con el tiempo acumulan datos creados/editados/eliminados durante
   * los exámenes y hace falta reiniciarlas para la siguiente aplicación.
   */
  @Post('reset-practice-data')
  async resetPracticeData(@Req() req: Request) {
    this.assertAllowed(req);
    await this.todoApiService.reset();
    await this.practiceApiService.resetAll();
    return { success: true };
  }
}
