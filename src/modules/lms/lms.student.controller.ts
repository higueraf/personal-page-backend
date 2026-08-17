import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { User } from '../../entities/user.entity';
import { LmsCoursesService } from './lms-courses.service';
import { LmsActivitiesService } from './lms-activities.service';
import { LmsForumService } from './lms-forum.service';
import { LmsAssignmentsService } from './lms-assignments.service';
import { LmsQuizzesService } from './lms-quizzes.service';
import { CreateForumPostDto, CreateForumThreadDto, SubmitAssignmentDto, SubmitQuizAttemptDto } from './dto/lms.dto';

type AuthedRequest = Request & { user: User };

/** Consumo del LMS por el alumno: inscripción, actividades, foro, entregas y quizzes. Requiere sesión. */
@UseGuards(JwtAuthGuard)
@Controller('public/lms')
export class LmsStudentController {
  constructor(
    private readonly coursesService: LmsCoursesService,
    private readonly activitiesService: LmsActivitiesService,
    private readonly forumService: LmsForumService,
    private readonly assignmentsService: LmsAssignmentsService,
    private readonly quizzesService: LmsQuizzesService,
  ) {}

  @Post('courses/:id/enroll') enroll(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.coursesService.enroll(id, req.user);
  }
  @Get('my-courses') myCourses(@Req() req: AuthedRequest) {
    return this.coursesService.myCourses(req.user);
  }

  @Get('activities/:id') getActivity(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.activitiesService.studentView(id, req.user);
  }

  // ── Foro ─────────────────────────────────────────────────────────────────
  @Get('activities/:id/forum-threads') listThreads(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.forumService.listThreads(id, req.user);
  }
  @Get('forum-threads/:id') getThread(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.forumService.getThread(id, req.user);
  }
  @Post('forum-threads') createThread(@Body() dto: CreateForumThreadDto, @Req() req: AuthedRequest) {
    return this.forumService.createThread(dto, req.user);
  }
  @Post('forum-posts') createPost(@Body() dto: CreateForumPostDto, @Req() req: AuthedRequest) {
    return this.forumService.createPost(dto, req.user);
  }

  // ── Tareas / exámenes manuales ───────────────────────────────────────────
  @Get('activities/:id/submission') mySubmission(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.assignmentsService.mySubmission(id, req.user);
  }
  @Post('activities/:id/submit') submit(@Param('id') id: string, @Body() dto: SubmitAssignmentDto, @Req() req: AuthedRequest) {
    return this.assignmentsService.submit(id, dto, req.user);
  }

  // ── Quizzes / exámenes autoevaluables ────────────────────────────────────
  @Get('activities/:id/quiz-questions') quizQuestions(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.quizzesService.listQuestionsForStudent(id, req.user);
  }
  @Post('activities/:id/quiz-attempts') submitAttempt(
    @Param('id') id: string,
    @Body() dto: SubmitQuizAttemptDto,
    @Req() req: AuthedRequest,
  ) {
    return this.quizzesService.submitAttempt(id, dto, req.user);
  }
  @Get('activities/:id/quiz-attempts') myAttempts(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.quizzesService.myAttempts(id, req.user);
  }
}
