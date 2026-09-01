import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query, Req, Res, UseGuards } from '@nestjs/common';
import { Request, Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../../common/roles.decorator';
import { User } from '../../entities/user.entity';
import { LmsCoursesService } from './lms-courses.service';
import { LmsActivitiesService } from './lms-activities.service';
import { LmsForumService } from './lms-forum.service';
import { LmsAssignmentsService } from './lms-assignments.service';
import { LmsQuizzesService } from './lms-quizzes.service';
import { LmsSurveysService } from './lms-surveys.service';
import {
  CreateQuizFromFileDto,
  GradeSubmissionDto,
  ImportQuizQuestionsDto,
  ImportSurveyMarkdownDto,
  UpsertLmsActivityDto,
  UpsertLmsCourseDto,
  UpsertLmsUnitDto,
  UpsertQuizQuestionDto,
  UpsertSurveyQuestionDto,
} from './dto/lms.dto';
import { QuizFileFormat } from './quiz-question-format.types';

type AuthedRequest = Request & { user: User };

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'teacher')
@Controller('lms')
export class LmsAdminController {
  constructor(
    private readonly coursesService: LmsCoursesService,
    private readonly activitiesService: LmsActivitiesService,
    private readonly forumService: LmsForumService,
    private readonly assignmentsService: LmsAssignmentsService,
    private readonly quizzesService: LmsQuizzesService,
    private readonly surveysService: LmsSurveysService,
  ) {}

  // ── Cursos y unidades ────────────────────────────────────────────────────
  @Get('courses') listCourses(@Req() req: AuthedRequest, @Query() q: any) {
    return this.coursesService.listForTeacher(req.user, q);
  }
  @Get('courses/:id') getCourse(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.coursesService.getForManage(id, req.user);
  }
  @Post('courses') createCourse(@Body() dto: UpsertLmsCourseDto, @Req() req: AuthedRequest) {
    return this.coursesService.create(dto, req.user);
  }
  @Put('courses/:id') updateCourse(@Param('id') id: string, @Body() dto: Partial<UpsertLmsCourseDto>, @Req() req: AuthedRequest) {
    return this.coursesService.update(id, dto, req.user);
  }
  @Put('courses/:id/archive') archiveCourse(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.coursesService.archive(id, req.user);
  }
  @Get('courses/:id/units') listUnits(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.coursesService.listUnits(id, req.user);
  }
  @Get('courses/:id/roster') roster(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.coursesService.roster(id, req.user);
  }

  @Post('units') createUnit(@Body() dto: UpsertLmsUnitDto, @Req() req: AuthedRequest) {
    return this.coursesService.createUnit(dto, req.user);
  }
  @Put('units/:id') updateUnit(@Param('id') id: string, @Body() dto: Partial<UpsertLmsUnitDto>, @Req() req: AuthedRequest) {
    return this.coursesService.updateUnit(id, dto, req.user);
  }
  @HttpCode(204) @Delete('units/:id') async deleteUnit(@Param('id') id: string, @Req() req: AuthedRequest) {
    await this.coursesService.deleteUnit(id, req.user);
  }

  // ── Actividades ──────────────────────────────────────────────────────────
  @Get('units/:unitId/activities') listActivities(@Param('unitId') unitId: string, @Req() req: AuthedRequest) {
    return this.activitiesService.listByUnit(unitId, req.user);
  }
  @Post('activities') createActivity(@Body() dto: UpsertLmsActivityDto, @Req() req: AuthedRequest) {
    return this.activitiesService.create(dto, req.user);
  }
  @Put('activities/:id') updateActivity(@Param('id') id: string, @Body() dto: Partial<UpsertLmsActivityDto>, @Req() req: AuthedRequest) {
    return this.activitiesService.update(id, dto, req.user);
  }
  @HttpCode(204) @Delete('activities/:id') async deleteActivity(@Param('id') id: string, @Req() req: AuthedRequest) {
    await this.activitiesService.delete(id, req.user);
  }

  // ── Foro (moderación) ────────────────────────────────────────────────────
  @Get('activities/:id/forum-threads') listThreads(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.forumService.listThreads(id, req.user);
  }
  @Put('forum-threads/:id/moderate') moderateThread(
    @Param('id') id: string,
    @Body() patch: { is_pinned?: boolean; is_locked?: boolean },
    @Req() req: AuthedRequest,
  ) {
    return this.forumService.setThreadModeration(id, patch, req.user);
  }

  // ── Tareas / exámenes manuales: revisión y calificación ─────────────────
  @Get('activities/:id/submissions') listSubmissions(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.assignmentsService.listSubmissions(id, req.user);
  }
  @Put('submissions/:id/grade') gradeSubmission(@Param('id') id: string, @Body() dto: GradeSubmissionDto, @Req() req: AuthedRequest) {
    return this.assignmentsService.grade(id, dto, req.user);
  }

  // ── Banco de preguntas de quiz/examen ────────────────────────────────────
  @Get('activities/:id/quiz-questions') listQuestions(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.quizzesService.listQuestionsForManage(id, req.user);
  }
  @Post('quiz-questions') upsertQuestion(@Body() dto: UpsertQuizQuestionDto, @Req() req: AuthedRequest) {
    return this.quizzesService.upsertQuestion(dto, req.user);
  }
  @HttpCode(204) @Delete('quiz-questions/:id') async deleteQuestion(@Param('id') id: string, @Req() req: AuthedRequest) {
    await this.quizzesService.deleteQuestion(id, req.user);
  }
  @Post('activities/:id/quiz-questions/import') importQuizQuestions(
    @Param('id') id: string,
    @Body() dto: ImportQuizQuestionsDto,
    @Req() req: AuthedRequest,
  ) {
    return this.quizzesService.importQuestions(id, dto, req.user);
  }
  @Get('activities/:id/quiz-questions/export') async exportQuizQuestions(
    @Param('id') id: string,
    @Query('format') format: QuizFileFormat,
    @Req() req: AuthedRequest,
    @Res() res: Response,
  ) {
    const { filename, mimeType, content, warnings } = await this.quizzesService.exportQuestions(id, format, req.user);
    if (warnings.length) res.setHeader('X-Export-Warnings', encodeURIComponent(warnings.join(' | ')));
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(content);
  }
  @Post('units/:unitId/quiz-import') createQuizFromFile(
    @Param('unitId') unitId: string,
    @Body() dto: CreateQuizFromFileDto,
    @Req() req: AuthedRequest,
  ) {
    return this.quizzesService.createFromFile(unitId, dto, req.user);
  }

  // ── Encuestas: banco de preguntas, importación y resultados ─────────────
  @Get('activities/:id/survey-questions') listSurveyQuestions(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.surveysService.listQuestionsForManage(id, req.user);
  }
  @Post('survey-questions') upsertSurveyQuestion(@Body() dto: UpsertSurveyQuestionDto, @Req() req: AuthedRequest) {
    return this.surveysService.upsertQuestion(dto, req.user);
  }
  @HttpCode(204) @Delete('survey-questions/:id') async deleteSurveyQuestion(@Param('id') id: string, @Req() req: AuthedRequest) {
    await this.surveysService.deleteQuestion(id, req.user);
  }
  @Post('activities/:id/survey-questions/import') importSurveyQuestions(
    @Param('id') id: string,
    @Body() dto: ImportSurveyMarkdownDto,
    @Req() req: AuthedRequest,
  ) {
    return this.surveysService.importQuestions(id, dto.markdown, req.user);
  }
  @Get('activities/:id/survey-results') surveyResults(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.surveysService.getResults(id, req.user);
  }
}
