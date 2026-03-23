import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt.guard';
import { VideoCoursesService } from './video-courses.service';

@Controller('public/video-courses')
export class VideoCoursesPublicController {
  constructor(private readonly service: VideoCoursesService) {}

  @Get() list(
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('page_size') pageSize?: string,
  ) {
    return this.service.publicList(search, Number(page || 1), Number(pageSize || 12));
  }
  @Get(':slug') meta(@Param('slug') slug: string) { return this.service.publicMeta(slug); }

  @UseGuards(OptionalJwtAuthGuard)
  @Get(':courseSlug/lessons/:lessonSlug')
  lesson(@Param('courseSlug') courseSlug: string, @Param('lessonSlug') lessonSlug: string, @Req() req: Request & { user?: any }) {
    return this.service.publicLesson(courseSlug, lessonSlug, req.user);
  }
}
