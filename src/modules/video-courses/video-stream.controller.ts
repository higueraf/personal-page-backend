import { Controller, Get, NotFoundException, Param, Res } from '@nestjs/common';
import { Response } from 'express';
import { createReadStream, existsSync, statSync } from 'fs';
import { VideoCoursesService } from './video-courses.service';

@Controller('video-stream')
export class VideoStreamController {
  constructor(private readonly service: VideoCoursesService) {}

  @Get(':lessonId')
  async stream(@Param('lessonId') lessonId: string, @Res() res: Response) {
    const videoFile = await this.service.getVideoFileByLessonId(lessonId);
    if (!videoFile) throw new NotFoundException('No hay archivo de video');
    if (/^https?:\/\//i.test(videoFile)) {
      return res.redirect(videoFile);
    }
    if (!existsSync(videoFile)) {
      throw new NotFoundException('Archivo no encontrado');
    }
    const stat = statSync(videoFile);
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Length', stat.size);
    return createReadStream(videoFile).pipe(res);
  }
}
