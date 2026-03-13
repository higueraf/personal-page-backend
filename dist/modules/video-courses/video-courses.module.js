"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VideoCoursesModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const video_course_entity_1 = require("../../entities/video-course.entity");
const video_lesson_entity_1 = require("../../entities/video-lesson.entity");
const video_section_entity_1 = require("../../entities/video-section.entity");
const video_courses_admin_controller_1 = require("./video-courses.admin.controller");
const video_courses_public_controller_1 = require("./video-courses.public.controller");
const video_courses_service_1 = require("./video-courses.service");
const video_stream_controller_1 = require("./video-stream.controller");
let VideoCoursesModule = class VideoCoursesModule {
};
exports.VideoCoursesModule = VideoCoursesModule;
exports.VideoCoursesModule = VideoCoursesModule = __decorate([
    (0, common_1.Module)({
        imports: [typeorm_1.TypeOrmModule.forFeature([video_course_entity_1.VideoCourse, video_section_entity_1.VideoSection, video_lesson_entity_1.VideoLesson])],
        providers: [video_courses_service_1.VideoCoursesService],
        controllers: [video_courses_admin_controller_1.VideoCoursesAdminController, video_courses_public_controller_1.VideoCoursesPublicController, video_stream_controller_1.VideoStreamController],
    })
], VideoCoursesModule);
//# sourceMappingURL=video-courses.module.js.map