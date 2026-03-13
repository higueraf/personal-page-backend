import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContentBlock } from '../../entities/content-block.entity';
import { Course } from '../../entities/course.entity';
import { CourseSection } from '../../entities/course-section.entity';
import { LessonPage } from '../../entities/lesson-page.entity';
import { Lesson } from '../../entities/lesson.entity';
import { TutorialsAdminController } from './tutorials.admin.controller';
import { TutorialsPublicController } from './tutorials.public.controller';
import { TutorialsService } from './tutorials.service';

@Module({
  imports: [TypeOrmModule.forFeature([Course, CourseSection, Lesson, LessonPage, ContentBlock])],
  providers: [TutorialsService],
  controllers: [TutorialsAdminController, TutorialsPublicController],
})
export class TutorialsModule {}
