import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Req, ForbiddenException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PlaygroundService } from './playground.service';
import { ExecutionService } from './execution.service';
import { Request } from 'express';

@Controller('playground')
@UseGuards(JwtAuthGuard)
export class PlaygroundController {
  constructor(
    private playgroundService: PlaygroundService,
    private executionService: ExecutionService,
  ) {}

  @Get()
  async getProjects(@Req() req: Request) {
    const user = req.user as any;
    return this.playgroundService.findAllByUser(user.id);
  }

  @Get('status')
  async getSystemStatus() {
    const dockerAvailable = await this.executionService.checkDockerAvailability();
    return {
      docker: dockerAvailable,
      message: dockerAvailable
        ? 'Docker disponible - Playground listo para usar'
        : 'Docker no disponible - Instala Docker para usar el playground',
    };
  }

  @Post()
  async createProject(@Req() req: Request, @Body() data: any) {
    const user = req.user as any;
    return this.playgroundService.create(user.id, data);
  }

  @Get(':id')
  async getProject(@Req() req: Request, @Param('id') id: string) {
    const user = req.user as any;
    return this.playgroundService.findOne(id, user.id);
  }

  @Put(':id/files/:name')
  async updateFile(
    @Req() req: Request,
    @Param('id') id: string,
    @Param('name') name: string,
    @Body('content') content: string,
    @Body('is_folder') is_folder: boolean,
    @Body('path') path: string,
  ) {
    const user = req.user as any;
    return this.playgroundService.updateFile(id, name, content, user.id, is_folder, path);
  }

  @Delete(':id/files/:fileId')
  async deleteFile(
    @Req() req: Request,
    @Param('id') id: string,
    @Param('fileId') fileId: string,
  ) {
    const user = req.user as any;
    return this.playgroundService.deleteFile(id, fileId, user.id);
  }

  @Delete(':id')
  async deleteProject(@Req() req: Request, @Param('id') id: string) {
    const user = req.user as any;
    return this.playgroundService.delete(id, user.id);
  }

  @Post('execute')
  async executeCode(@Body() data: { language: string; files: any[] }) {
    return this.executionService.execute(data.language, data.files);
  }

  @Get('runtimes')
  async getSupportedRuntimes() {
    return this.executionService.getRuntimes();
  }

  @Post(':id/log-cheat')
  async logCheat(
    @Req() req: Request,
    @Param('id') id: string,
    @Body('action') action: string,
    @Body('details') details?: string,
  ) {
    const user = req.user as any;
    return this.playgroundService.logCheat(id, user.id, action, details);
  }

  /**
   * Admin/Teacher: assign an exam project to one or more students.
   * Body: {
   *   studentIds: string[],        // array of user UUIDs
   *   name: string,
   *   language: string,
   *   materia?: string,
   *   start_time?: string,         // ISO date
   *   end_time?: string,           // ISO date
   *   allow_copy_paste?: boolean,  // defaults to false for exams
   *   files?: { name, content, path }[]
   * }
   */
  @Post('admin/assign-exam')
  async assignExam(@Req() req: Request, @Body() data: any) {
    const teacher = req.user as any;

    // Basic role guard: only admin or teacher roles may assign exams
    const allowedRoles = ['admin', 'teacher'];
    if (!allowedRoles.includes(teacher.role?.name?.toLowerCase())) {
      throw new ForbiddenException('Solo administradores o profesores pueden asignar exámenes.');
    }

    let studentIds: string[] = [];
    if (data.courseId) {
      studentIds = await this.playgroundService.getStudentsFromCourse(data.courseId);
      if (studentIds.length === 0) throw new ForbiddenException('El curso no tiene alumnos activos.');
    } else {
      studentIds = Array.isArray(data.studentIds)
        ? data.studentIds
        : data.studentId ? [data.studentId] : [];
    }
    
    if (studentIds.length === 0) {
      throw new ForbiddenException('No se han provisto estudiantes o curso para asignar el examen.');
    }

    const results = await Promise.all(
      studentIds.map((studentId) =>
        this.playgroundService.assignExam(teacher.id, studentId, {
          name:             data.name,
          language:         data.language ?? 'python',
          materia:          data.materia,
          start_time:       data.start_time ? new Date(data.start_time) : undefined,
          end_time:         data.end_time   ? new Date(data.end_time)   : undefined,
          allow_copy_paste: data.allow_copy_paste ?? false, // exams block copy-paste by default
          files:            data.files,
        }),
      ),
    );

    return { data: results, count: results.length };
  }

  /**
   * Admin/Teacher: list all assigned exams (Playground projects with is_exam=true)
   */
  @Get('admin/exams')
  async getAllExams(@Req() req: Request) {
    const teacher = req.user as any;
    const allowedRoles = ['admin', 'teacher'];
    if (!allowedRoles.includes(teacher.role?.name?.toLowerCase())) {
      throw new ForbiddenException('Solo administradores o profesores pueden ver los exámenes.');
    }
    
    const exams = await this.playgroundService.findAllAdminExams();
    return { data: exams };
  }
}
