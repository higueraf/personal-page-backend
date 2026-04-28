import { Controller, Get, Post, Put, Patch, Delete, Body, Param, UseGuards, Req, Res, ForbiddenException, NotFoundException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PlaygroundService } from './playground.service';
import { ExecutionService } from './execution.service';
import { Request, Response } from 'express';

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
    return this.playgroundService.findOne(id, user.id, user.role?.name);
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

  @Post(':id/submit')
  async submitExam(@Req() req: Request, @Param('id') id: string) {
    const user = req.user as any;
    return this.playgroundService.submitExam(id, user.id);
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

    // All projects from this batch share the same exam_group_id
    const { randomUUID } = await import('crypto');
    const exam_group_id = randomUUID();

    const results = await Promise.all(
      studentIds.map((studentId) =>
        this.playgroundService.assignExam(teacher.id, studentId, {
          name:             data.name,
          language:         data.language ?? 'python',
          materia:          data.materia,
          start_time:       data.start_time ? new Date(data.start_time) : undefined,
          end_time:         data.end_time   ? new Date(data.end_time)   : undefined,
          allow_copy_paste: data.allow_copy_paste ?? false,
          require_seb:      data.require_seb ?? false,
          files:            data.files,
          exam_group_id,
        }),
      ),
    );

    return { data: results, count: results.length, exam_group_id };
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

  /**
   * Admin/Teacher: list all playgrounds (exams and normal projects)
   */
  @Get('admin/playgrounds')
  async getAllPlaygrounds(@Req() req: Request) {
    const teacher = req.user as any;
    const allowedRoles = ['admin', 'teacher'];
    if (!allowedRoles.includes(teacher.role?.name?.toLowerCase())) {
      throw new ForbiddenException('Solo administradores o profesores pueden ver los playgrounds.');
    }

    const playgrounds = await this.playgroundService.findAllAdminPlaygrounds();
    return { data: playgrounds };
  }

  /**
   * Admin/Teacher: list exam groups (one entry per assignment batch)
   */
  @Get('admin/exam-groups')
  async getExamGroups(@Req() req: Request) {
    const user = req.user as any;
    const allowedRoles = ['admin', 'teacher'];
    if (!allowedRoles.includes(user.role?.name?.toLowerCase())) {
      throw new ForbiddenException('Solo administradores o profesores pueden ver los exámenes.');
    }
    return { data: await this.playgroundService.findAdminExamGroups() };
  }

  /**
   * Admin/Teacher: list all student projects for a specific exam group
   */
  @Get('admin/exam-groups/:groupId/projects')
  async getExamGroupProjects(@Req() req: Request, @Param('groupId') groupId: string) {
    const user = req.user as any;
    const allowedRoles = ['admin', 'teacher'];
    if (!allowedRoles.includes(user.role?.name?.toLowerCase())) {
      throw new ForbiddenException('Solo administradores o profesores pueden ver los exámenes.');
    }
    return { data: await this.playgroundService.findAdminExamsByGroup(groupId) };
  }

  /**
   * Admin/Teacher: change status of a single exam project
   */
  @Patch('admin/exam/:id/status')
  async changeExamStatus(@Req() req: Request, @Param('id') id: string, @Body('status') status: string) {
    const user = req.user as any;
    const allowedRoles = ['admin', 'teacher'];
    if (!allowedRoles.includes(user.role?.name?.toLowerCase())) {
      throw new ForbiddenException('Solo administradores o profesores pueden cambiar el estado de exámenes.');
    }
    const { ProjectStatus } = await import('../../entities/playground-project.entity');
    const validStatuses = Object.values(ProjectStatus);
    if (!validStatuses.includes(status as any)) {
      throw new ForbiddenException(`Estado inválido. Valores permitidos: ${validStatuses.join(', ')}`);
    }
    return this.playgroundService.changeExamStatus(id, status as any);
  }

  /**
   * Admin/Teacher: change status of all projects in an exam group
   */
  @Patch('admin/exam-groups/:groupId/status')
  async changeExamGroupStatus(@Req() req: Request, @Param('groupId') groupId: string, @Body('status') status: string) {
    const user = req.user as any;
    const allowedRoles = ['admin', 'teacher'];
    if (!allowedRoles.includes(user.role?.name?.toLowerCase())) {
      throw new ForbiddenException('Solo administradores o profesores pueden cambiar el estado de exámenes.');
    }
    const { ProjectStatus } = await import('../../entities/playground-project.entity');
    const validStatuses = Object.values(ProjectStatus);
    if (!validStatuses.includes(status as any)) {
      throw new ForbiddenException(`Estado inválido. Valores permitidos: ${validStatuses.join(', ')}`);
    }
    return this.playgroundService.changeExamGroupStatus(groupId, status as any);
  }

  /**
   * Admin/Teacher: update all projects in an exam group
   */
  @Patch('admin/exam-groups/:groupId')
  async updateExamGroup(@Req() req: Request, @Param('groupId') groupId: string, @Body() body: any) {
    const user = req.user as any;
    const allowedRoles = ['admin', 'teacher'];
    if (!allowedRoles.includes(user.role?.name?.toLowerCase())) {
      throw new ForbiddenException('Solo administradores o profesores pueden editar exámenes.');
    }
    return this.playgroundService.updateAdminExamGroup(groupId, {
      name:            body.name,
      start_time:      body.start_time ? new Date(body.start_time) : body.start_time,
      end_time:        body.end_time   ? new Date(body.end_time)   : body.end_time,
      allow_copy_paste: body.allow_copy_paste,
      require_seb:      body.require_seb,
    });
  }

  /**
   * Admin/Teacher: download Safe Exam Browser config file (.seb) for an exam group.
   * The .seb file points to the frontend so SEB opens the app directly in kiosk mode.
   */
  @Get('admin/exam-groups/:groupId/seb-config')
  async downloadSebConfig(
    @Req() req: Request,
    @Res() res: Response,
    @Param('groupId') groupId: string,
  ) {
    const user = req.user as any;
    const allowedRoles = ['admin', 'teacher'];
    if (!allowedRoles.includes(user.role?.name?.toLowerCase())) {
      throw new ForbiddenException('Solo administradores o profesores pueden descargar la configuración SEB.');
    }

    // Resolve the exam group to get a name for the filename
    const projects = await this.playgroundService.findAdminExamsByGroup(groupId);
    if (!projects || projects.length === 0) throw new NotFoundException('Exam group not found');
    const examName = (projects[0] as any).name ?? 'examen';

    // Frontend base URL: use first origin from APP_ORIGINS or fallback
    const origins = (process.env.APP_ORIGINS ?? 'http://localhost:5173').split(',');
    const frontendUrl = origins[origins.length - 1].trim(); // prefer production URL (last entry)

    // Build the start URL pointing directly to the student's exam list filtered by group
    const startUrl = `${frontendUrl}/playground`;

    const quitUrl = `${frontendUrl}/seb-quit`;

    const sebXml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>startURL</key>
  <string>${startUrl}</string>
  <key>sendBrowserExamKey</key>
  <false/>
  <key>allowQuit</key>
  <false/>
  <key>ignoreExitKey</key>
  <true/>
  <key>quitURL</key>
  <string>${quitUrl}</string>
  <key>quitURLConfirm</key>
  <false/>
  <key>browserWindowAllowReload</key>
  <false/>
  <key>showReloadButton</key>
  <false/>
  <key>showTaskBar</key>
  <false/>
  <key>enablePrintScreen</key>
  <false/>
  <key>allowUserSwitching</key>
  <false/>
  <key>enableScreenCapture</key>
  <false/>
  <key>newBrowserWindowByLinkPolicy</key>
  <integer>2</integer>
  <key>URLFilterEnable</key>
  <true/>
  <key>URLFilterEnableContentFilter</key>
  <false/>
  <key>URLFilterRules</key>
  <array>
    <dict>
      <key>active</key>
      <true/>
      <key>regex</key>
      <false/>
      <key>action</key>
      <integer>1</integer>
      <key>expression</key>
      <string>${frontendUrl}/*</string>
    </dict>
  </array>
</dict>
</plist>`;

    const safeExamName = examName.replace(/[^a-zA-Z0-9_\-áéíóúñÁÉÍÓÚÑ ]/g, '_').trim();
    res.setHeader('Content-Type', 'application/seb');
    res.setHeader('Content-Disposition', `attachment; filename="${safeExamName}.seb"`);
    res.send(sebXml);
  }

  /**
   * Admin/Teacher: delete all projects in an exam group
   */
  @Delete('admin/exam-groups/:groupId')
  async deleteExamGroup(@Req() req: Request, @Param('groupId') groupId: string) {
    const user = req.user as any;
    const allowedRoles = ['admin', 'teacher'];
    if (!allowedRoles.includes(user.role?.name?.toLowerCase())) {
      throw new ForbiddenException('Solo administradores o profesores pueden eliminar exámenes.');
    }
    return this.playgroundService.deleteAdminExamGroup(groupId);
  }
}
