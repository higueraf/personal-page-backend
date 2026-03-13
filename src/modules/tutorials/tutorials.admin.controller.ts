import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards, HttpCode } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TutorialsService } from './tutorials.service';
import { UpsertBlockDto, UpsertCourseDto, UpsertLessonDto, UpsertPageDto, UpsertSectionDto } from './dto/tutorial.dto';

@UseGuards(JwtAuthGuard)
@Controller()
export class TutorialsAdminController {
  constructor(private readonly service: TutorialsService) {}

  @Get('courses') listCourses(@Query() q: any) { return this.service.listCourses(q); }
  @Get('courses/:id') getCourse(@Param('id') id: string) { return this.service.getCourse(id); }
  @Post('courses') createCourse(@Body() dto: UpsertCourseDto) { return this.service.createCourse(dto); }
  @Put('courses/:id') updateCourse(@Param('id') id: string, @Body() dto: Partial<UpsertCourseDto>) { return this.service.updateCourse(id, dto); }
  @HttpCode(204) @Delete('courses/:id') async deleteCourse(@Param('id') id: string) { await this.service.deleteCourse(id); }

  @Get('course-sections') listSections(@Query() q: any) { return this.service.listSections(q); }
  @Get('course-sections/:id') getSection(@Param('id') id: string) { return this.service.getSection(id); }
  @Post('course-sections') createSection(@Body() dto: UpsertSectionDto) { return this.service.createSection(dto); }
  @Put('course-sections/:id') updateSection(@Param('id') id: string, @Body() dto: Partial<UpsertSectionDto>) { return this.service.updateSection(id, dto); }
  @HttpCode(204) @Delete('course-sections/:id') async deleteSection(@Param('id') id: string) { await this.service.deleteSection(id); }

  @Get('lessons') listLessons(@Query() q: any) { return this.service.listLessons(q); }
  @Get('lessons/:id') getLesson(@Param('id') id: string) { return this.service.getLesson(id); }
  @Post('lessons') createLesson(@Body() dto: UpsertLessonDto) { return this.service.createLesson(dto); }
  @Put('lessons/:id') updateLesson(@Param('id') id: string, @Body() dto: Partial<UpsertLessonDto>) { return this.service.updateLesson(id, dto); }
  @HttpCode(204) @Delete('lessons/:id') async deleteLesson(@Param('id') id: string) { await this.service.deleteLesson(id); }

  @Get('lesson-pages') listPages(@Query() q: any) { return this.service.listPages(q); }
  @Get('lesson-pages/:id') getPage(@Param('id') id: string) { return this.service.getPage(id); }
  @Post('lesson-pages') createPage(@Body() dto: UpsertPageDto) { return this.service.createPage(dto); }
  @Put('lesson-pages/:id') updatePage(@Param('id') id: string, @Body() dto: Partial<UpsertPageDto>) { return this.service.updatePage(id, dto); }
  @HttpCode(204) @Delete('lesson-pages/:id') async deletePage(@Param('id') id: string) { await this.service.deletePage(id); }

  @Get('content-blocks') listBlocks(@Query() q: any) { return this.service.listBlocks(q); }
  @Get('content-blocks/:id') getBlock(@Param('id') id: string) { return this.service.getBlock(id); }
  @Post('content-blocks') createBlock(@Body() dto: UpsertBlockDto) { return this.service.createBlock(dto); }
  @Put('content-blocks/:id') updateBlock(@Param('id') id: string, @Body() dto: Partial<UpsertBlockDto>) { return this.service.updateBlock(id, dto); }
  @HttpCode(204) @Delete('content-blocks/:id') async deleteBlock(@Param('id') id: string) { await this.service.deleteBlock(id); }
}
