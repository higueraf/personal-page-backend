import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LmsCourse } from '../../entities/lms-course.entity';
import { LmsCourseUnit } from '../../entities/lms-course-unit.entity';
import { LmsActivity } from '../../entities/lms-activity.entity';
import { LmsForumThread } from '../../entities/lms-forum-thread.entity';
import { LmsForumPost } from '../../entities/lms-forum-post.entity';
import { LmsSubmission } from '../../entities/lms-submission.entity';
import { LmsSubmissionFile } from '../../entities/lms-submission-file.entity';
import { LmsQuizQuestion } from '../../entities/lms-quiz-question.entity';
import { LmsQuizOption } from '../../entities/lms-quiz-option.entity';
import { LmsQuizAttempt } from '../../entities/lms-quiz-attempt.entity';
import { LmsQuizAnswer } from '../../entities/lms-quiz-answer.entity';
import { LmsEnrollment } from '../../entities/lms-enrollment.entity';
import { LmsActivityProgress } from '../../entities/lms-activity-progress.entity';
import { LmsSurveyQuestion } from '../../entities/lms-survey-question.entity';
import { LmsSurveyOption } from '../../entities/lms-survey-option.entity';
import { LmsSurveyResponse } from '../../entities/lms-survey-response.entity';
import { LmsSurveyAnswer } from '../../entities/lms-survey-answer.entity';
import { StudyCourse } from '../../entities/study-course.entity';
import { User } from '../../entities/user.entity';
import { LmsCoursesService } from './lms-courses.service';
import { LmsActivitiesService } from './lms-activities.service';
import { LmsForumService } from './lms-forum.service';
import { LmsAssignmentsService } from './lms-assignments.service';
import { LmsQuizzesService } from './lms-quizzes.service';
import { LmsSurveysService } from './lms-surveys.service';
import { LmsAdminController } from './lms.admin.controller';
import { LmsPublicController } from './lms.public.controller';
import { LmsStudentController } from './lms.student.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      LmsCourse,
      LmsCourseUnit,
      LmsActivity,
      LmsForumThread,
      LmsForumPost,
      LmsSubmission,
      LmsSubmissionFile,
      LmsQuizQuestion,
      LmsQuizOption,
      LmsQuizAttempt,
      LmsQuizAnswer,
      LmsEnrollment,
      LmsActivityProgress,
      LmsSurveyQuestion,
      LmsSurveyOption,
      LmsSurveyResponse,
      LmsSurveyAnswer,
      StudyCourse,
      User,
    ]),
  ],
  providers: [
    LmsCoursesService,
    LmsActivitiesService,
    LmsForumService,
    LmsAssignmentsService,
    LmsQuizzesService,
    LmsSurveysService,
  ],
  controllers: [LmsAdminController, LmsPublicController, LmsStudentController],
})
export class LmsModule {}
