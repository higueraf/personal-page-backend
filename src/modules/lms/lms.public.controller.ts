import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt.guard';
import { LmsCoursesService } from './lms-courses.service';

/** Catálogo de cursos LMS abierto, sin autenticación (equivalente a un catálogo tipo Udemy).
 *  Los cursos no públicos (`is_public = false`) no aparecen aquí ni son accesibles por slug;
 *  ver `LmsCoursesService.hasCourseAccess`. */
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

  @UseGuards(OptionalJwtAuthGuard)
  @Get('courses/:slug') detail(@Param('slug') slug: string, @Req() req: Request & { user?: any }) {
    return this.coursesService.publicDetail(slug, req.user ?? undefined);
  }
}
