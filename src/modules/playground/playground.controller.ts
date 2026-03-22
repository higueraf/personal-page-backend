import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Req } from '@nestjs/common';
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
        : 'Docker no disponible - Instala Docker para usar el playground'
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

  // Admin assigning exams
  @Post('assign')
  async assignExam(@Req() req: Request, @Body() data: any) {
    const teacher = req.user as any;
    // Simple role check: should check if teacher/admin
    // (In your project roles are handled in User entity)
    return this.playgroundService.assignExam(teacher.id, data.studentId, data.examData);
  }
}
