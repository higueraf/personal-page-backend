import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards, HttpCode } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UpsertVideoCourseDto, UpsertVideoLessonDto, UpsertVideoSectionDto } from './dto/video-course.dto';
import { VideoCoursesService } from './video-courses.service';

@UseGuards(JwtAuthGuard)
@Controller()
export class VideoCoursesAdminController {
  constructor(private readonly service: VideoCoursesService) {}

  @Get('video-courses') listCourses(@Query() q: any) { return this.service.listCourses(q); }
  @Get('video-courses/:id') getCourse(@Param('id') id: string) { return this.service.getCourse(id); }
  @Post('video-courses') createCourse(@Body() dto: UpsertVideoCourseDto) { return this.service.createCourse(dto); }
  @Put('video-courses/:id') updateCourse(@Param('id') id: string, @Body() dto: Partial<UpsertVideoCourseDto>) { return this.service.updateCourse(id, dto); }
  @HttpCode(204) @Delete('video-courses/:id') async deleteCourse(@Param('id') id: string) { await this.service.deleteCourse(id); }

  @Get('video-sections') listSections(@Query() q: any) { return this.service.listSections(q); }
  @Post('video-sections') createSection(@Body() dto: UpsertVideoSectionDto) { return this.service.createSection(dto); }
  @Put('video-sections/:id') updateSection(@Param('id') id: string, @Body() dto: Partial<UpsertVideoSectionDto>) { return this.service.updateSection(id, dto); }
  @HttpCode(204) @Delete('video-sections/:id') async deleteSection(@Param('id') id: string) { await this.service.deleteSection(id); }

  @Get('video-lessons') listLessons(@Query() q: any) { return this.service.listLessons(q); }
  @Post('video-lessons') createLesson(@Body() dto: UpsertVideoLessonDto) { return this.service.createLesson(dto); }
  @Put('video-lessons/:id') updateLesson(@Param('id') id: string, @Body() dto: Partial<UpsertVideoLessonDto>) { return this.service.updateLesson(id, dto); }
  @HttpCode(204) @Delete('video-lessons/:id') async deleteLesson(@Param('id') id: string) { await this.service.deleteLesson(id); }
}
