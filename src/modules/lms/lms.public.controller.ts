import { Controller, Get, Param, Query } from '@nestjs/common';
import { LmsCoursesService } from './lms-courses.service';

/** Catálogo de cursos LMS abierto, sin autenticación (equivalente a un catálogo tipo Udemy). */
@Controller('public/lms')
export class LmsPublicController {
  constructor(private readonly coursesService: LmsCoursesService) {}

  @Get('courses') catalog(
    @Query('search') search?: string,
    @Query('study_course_id') studyCourseId?: string,
    @Query('page') page?: string,
    @Query('page_size') pageSize?: string,
  ) {
    return this.coursesService.publicCatalog({
      search,
      study_course_id: studyCourseId,
      page: Number(page || 1),
      page_size: Number(pageSize || 12),
    });
  }

  @Get('courses/:slug') detail(@Param('slug') slug: string) {
    return this.coursesService.publicDetail(slug);
  }
}
