"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const typeorm_1 = require("@nestjs/typeorm");
const auth_module_1 = require("./modules/auth/auth.module");
const tutorials_module_1 = require("./modules/tutorials/tutorials.module");
const video_courses_module_1 = require("./modules/video-courses/video-courses.module");
const users_module_1 = require("./modules/users/users.module");
const projects_module_1 = require("./modules/projects/projects.module");
const profile_module_1 = require("./modules/profile/profile.module");
const resources_module_1 = require("./modules/resources/resources.module");
const contact_module_1 = require("./modules/contact/contact.module");
const app_seeder_1 = require("./database/app.seeder");
const content_block_entity_1 = require("./entities/content-block.entity");
const course_entity_1 = require("./entities/course.entity");
const course_section_entity_1 = require("./entities/course-section.entity");
const lesson_page_entity_1 = require("./entities/lesson-page.entity");
const lesson_entity_1 = require("./entities/lesson.entity");
const role_entity_1 = require("./entities/role.entity");
const user_entity_1 = require("./entities/user.entity");
const video_course_entity_1 = require("./entities/video-course.entity");
const video_lesson_entity_1 = require("./entities/video-lesson.entity");
const video_section_entity_1 = require("./entities/video-section.entity");
const project_entity_1 = require("./entities/project.entity");
const profile_item_entity_1 = require("./entities/profile-item.entity");
const resource_entity_1 = require("./entities/resource.entity");
const contact_info_entity_1 = require("./entities/contact-info.entity");
const contact_message_entity_1 = require("./entities/contact-message.entity");
const ALL_ENTITIES = [
    role_entity_1.Role, user_entity_1.User,
    course_entity_1.Course, course_section_entity_1.CourseSection, lesson_entity_1.Lesson, lesson_page_entity_1.LessonPage, content_block_entity_1.ContentBlock,
    video_course_entity_1.VideoCourse, video_section_entity_1.VideoSection, video_lesson_entity_1.VideoLesson,
    project_entity_1.Project,
    profile_item_entity_1.ProfileItem,
    resource_entity_1.Resource,
    contact_info_entity_1.ContactInfo, contact_message_entity_1.ContactMessage,
];
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({ isGlobal: true }),
            typeorm_1.TypeOrmModule.forRoot({
                type: 'postgres',
                host: process.env.DB_HOST || 'localhost',
                port: Number(process.env.DB_PORT || 5432),
                username: process.env.DB_USER || 'postgres',
                password: process.env.DB_PASS || 'postgres',
                database: process.env.DB_NAME || 'personal_page',
                entities: ALL_ENTITIES,
                synchronize: String(process.env.TYPEORM_SYNC || 'true') === 'true',
                autoLoadEntities: true,
                ssl: { rejectUnauthorized: false },
            }),
            typeorm_1.TypeOrmModule.forFeature(ALL_ENTITIES),
            auth_module_1.AuthModule,
            tutorials_module_1.TutorialsModule,
            video_courses_module_1.VideoCoursesModule,
            users_module_1.UsersModule,
            projects_module_1.ProjectsModule,
            profile_module_1.ProfileModule,
            resources_module_1.ResourcesModule,
            contact_module_1.ContactModule,
        ],
        providers: [app_seeder_1.AppSeeder],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map