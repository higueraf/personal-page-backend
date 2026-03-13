import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt.guard';
import { TutorialsService } from './tutorials.service';

@Controller('public')
export class TutorialsPublicController {
  constructor(private readonly service: TutorialsService) {}

  @Get('tutorials') listTutorials(@Query('search') search?: string) { return this.service.publicTutorials(search); }
  @Get('tutorials/:slug') tutorialMeta(@Param('slug') slug: string) { return this.service.publicTutorialMeta(slug); }

  @UseGuards(OptionalJwtAuthGuard)
  @Get('tutorials/:slug/pages') tutorialPages(@Param('slug') slug: string, @Req() req: Request & { user?: any }) {
    return this.service.publicTutorialPages(slug, req.user);
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Get('tutorials/:courseSlug/pages/:lessonSlug') tutorialContent(@Param('courseSlug') courseSlug: string, @Param('lessonSlug') lessonSlug: string, @Req() req: Request & { user?: any }) {
    return this.service.publicTutorialContent(courseSlug, lessonSlug, req.user);
  }

  @Get('courses') publicCourses(@Query() q: any) { return this.service.publicCourses(q); }
  @Get('courses/:slug') publicCourse(@Param('slug') slug: string) { return this.service.publicCourse(slug); }
  @Get('courses/:slug/curriculum') publicCurriculum(@Param('slug') slug: string) { return this.service.publicCurriculum(slug); }
  @Get('lessons/:courseSlug/:lessonSlug/pages/:pageOrder') publicLessonPage(@Param('courseSlug') courseSlug: string, @Param('lessonSlug') lessonSlug: string, @Param('pageOrder') pageOrder: string) {
    return this.service.publicLessonPage(courseSlug, lessonSlug, Number(pageOrder));
  }
}
