import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VideoCourse } from '../../entities/video-course.entity';
import { VideoLesson } from '../../entities/video-lesson.entity';
import { VideoSection } from '../../entities/video-section.entity';
import { VideoCoursesAdminController } from './video-courses.admin.controller';
import { VideoCoursesPublicController } from './video-courses.public.controller';
import { VideoCoursesService } from './video-courses.service';
import { VideoStreamController } from './video-stream.controller';

@Module({
  imports: [TypeOrmModule.forFeature([VideoCourse, VideoSection, VideoLesson])],
  providers: [VideoCoursesService],
  controllers: [VideoCoursesAdminController, VideoCoursesPublicController, VideoStreamController],
})
export class VideoCoursesModule {}
