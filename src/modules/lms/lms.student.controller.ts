import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { User } from '../../entities/user.entity';
import { LmsCoursesService } from './lms-courses.service';
import { LmsActivitiesService } from './lms-activities.service';
import { LmsForumService } from './lms-forum.service';
import { LmsAssignmentsService } from './lms-assignments.service';
import { LmsQuizzesService } from './lms-quizzes.service';
import { LmsSurveysService } from './lms-surveys.service';
import {
  CreateForumPostDto,
  CreateForumThreadDto,
  SubmitAssignmentDto,
  SubmitQuizAttemptDto,
  SubmitSurveyResponseDto,
} from './dto/lms.dto';

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
    private readonly surveysService: LmsSurveysService,
  ) {}

  @Post('courses/:id/enroll') enroll(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.coursesService.enroll(id, req.user);
  }
  @Get('my-courses') myCourses(@Req() req: AuthedRequest) {
    return this.coursesService.myCourses(req.user);
  }
  @Get('courses/:id/my-progress') myProgress(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.coursesService.myProgressForCourse(id, req.user);
  }

  @Get('activities/:id') getActivity(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.activitiesService.studentView(id, req.user);
  }
  @Post('activities/:id/complete') markComplete(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.activitiesService.markViewedComplete(id, req.user);
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

  @Post('activities/:id/submit-files')
  @UseInterceptors(FilesInterceptor('files', 10, {
    storage: diskStorage({
      destination: join(process.cwd(), 'uploads', 'lms-submissions'),
      filename: (_, file, cb) => cb(null, `${uuidv4()}${extname(file.originalname)}`),
    }),
    fileFilter: (_, file, cb) => {
      if (!/pdf|msword|officedocument|zip|png|jpe?g|plain/.test(file.mimetype)) {
        return cb(new BadRequestException('Tipo de archivo no permitido') as any, false);
      }
      cb(null, true);
    },
    limits: { fileSize: 20 * 1024 * 1024, files: 10 },
  }))
  submitFiles(
    @Param('id') id: string,
    @UploadedFiles() files: Express.Multer.File[],
    @Body('content_text') contentText: string | undefined,
    @Req() req: AuthedRequest,
  ) {
    return this.assignmentsService.submitFiles(id, files ?? [], contentText || undefined, req.user);
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

  // ── Encuestas ─────────────────────────────────────────────────────────────
  @Get('activities/:id/survey-questions') surveyQuestions(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.surveysService.listQuestionsForStudent(id, req.user);
  }
  @Get('activities/:id/survey-responses/me') mySurveyResponse(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.surveysService.myResponse(id, req.user);
  }
  @Post('activities/:id/survey-responses') submitSurveyResponse(
    @Param('id') id: string,
    @Body() dto: SubmitSurveyResponseDto,
    @Req() req: AuthedRequest,
  ) {
    return this.surveysService.submitResponse(id, dto, req.user);
  }
}
