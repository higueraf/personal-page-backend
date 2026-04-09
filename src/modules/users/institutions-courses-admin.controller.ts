import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { InstitutionsCoursesService } from './institutions-courses.service';
import { CreateInstitutionDto } from './dto/create-institution.dto';
import { CreateStudyCourseDto } from './dto/create-study-course.dto';
import { UpdateInstitutionDto } from './dto/update-institution.dto';
import { UpdateStudyCourseDto } from './dto/update-study-course.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard)
export class InstitutionsCoursesAdminController {
  constructor(private readonly institutionsCoursesService: InstitutionsCoursesService) {}

  // ── Instituciones ──────────────────────────────────────────────

  @Get('institutions')
  async listInstitutions() {
    return this.institutionsCoursesService.findAllInstitutions();
  }

  @Post('institutions')
  async createInstitution(@Body() dto: CreateInstitutionDto) {
    return this.institutionsCoursesService.createInstitution(dto);
  }

  @Patch('institutions/:id')
  async updateInstitution(@Param('id') id: string, @Body() dto: UpdateInstitutionDto) {
    return this.institutionsCoursesService.updateInstitution(id, dto);
  }

  @Delete('institutions/:id')
  async deleteInstitution(@Param('id') id: string) {
    return this.institutionsCoursesService.deleteInstitution(id);
  }

  // ── Cursos ─────────────────────────────────────────────────────

  @Get('study-courses')
  async listStudyCourses(@Query('institution_id') institution_id?: string) {
    return this.institutionsCoursesService.findAllStudyCourses(institution_id);
  }

  @Post('study-courses')
  async createStudyCourse(@Body() dto: CreateStudyCourseDto) {
    return this.institutionsCoursesService.createStudyCourse(dto);
  }

  @Patch('study-courses/:id')
  async updateStudyCourse(@Param('id') id: string, @Body() dto: UpdateStudyCourseDto) {
    return this.institutionsCoursesService.updateStudyCourse(id, dto);
  }

  @Delete('study-courses/:id')
  async deleteStudyCourse(@Param('id') id: string) {
    return this.institutionsCoursesService.deleteStudyCourse(id);
  }
}
