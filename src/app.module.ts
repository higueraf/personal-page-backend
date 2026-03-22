import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from './modules/auth/auth.module';
import { TutorialsModule } from './modules/tutorials/tutorials.module';
import { VideoCoursesModule } from './modules/video-courses/video-courses.module';
import { UsersModule } from './modules/users/users.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { ProfileModule } from './modules/profile/profile.module';
import { ResourcesModule } from './modules/resources/resources.module';
import { ContactModule } from './modules/contact/contact.module';
import { PlaygroundModule } from './modules/playground/playground.module';
import { AppSeeder } from './database/app.seeder';

import { ContentBlock } from './entities/content-block.entity';
import { Course } from './entities/course.entity';
import { CourseSection } from './entities/course-section.entity';
import { LessonPage } from './entities/lesson-page.entity';
import { Lesson } from './entities/lesson.entity';
import { Role } from './entities/role.entity';
import { User } from './entities/user.entity';
import { VideoCourse } from './entities/video-course.entity';
import { VideoLesson } from './entities/video-lesson.entity';
import { VideoSection } from './entities/video-section.entity';
import { Project } from './entities/project.entity';
import { ProfileItem } from './entities/profile-item.entity';
import { Resource } from './entities/resource.entity';
import { ContactInfo } from './entities/contact-info.entity';
import { ContactMessage } from './entities/contact-message.entity';
import { PlaygroundProject } from './entities/playground-project.entity';
import { PlaygroundFile } from './entities/playground-file.entity';

const ALL_ENTITIES = [
  Role, User,
  Course, CourseSection, Lesson, LessonPage, ContentBlock,
  VideoCourse, VideoSection, VideoLesson,
  Project,
  ProfileItem,
  Resource,
  ContactInfo, ContactMessage,
  PlaygroundProject, PlaygroundFile,
];

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT || 5432),
      username: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASS || 'postgres',
      database: process.env.DB_NAME || 'personal_page',
      entities: ALL_ENTITIES,
      synchronize: String(process.env.TYPEORM_SYNC || 'true') === 'true',
      autoLoadEntities: true,
      //ssl: { rejectUnauthorized: false },
    }),
    TypeOrmModule.forFeature(ALL_ENTITIES),
    AuthModule,
    TutorialsModule,
    VideoCoursesModule,
    UsersModule,
    ProjectsModule,
    ProfileModule,
    ResourcesModule,
    ContactModule,
    PlaygroundModule,
  ],
  providers: [AppSeeder],
})
export class AppModule { }
