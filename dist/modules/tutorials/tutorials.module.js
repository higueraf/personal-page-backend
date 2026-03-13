"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TutorialsModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const content_block_entity_1 = require("../../entities/content-block.entity");
const course_entity_1 = require("../../entities/course.entity");
const course_section_entity_1 = require("../../entities/course-section.entity");
const lesson_page_entity_1 = require("../../entities/lesson-page.entity");
const lesson_entity_1 = require("../../entities/lesson.entity");
const tutorials_admin_controller_1 = require("./tutorials.admin.controller");
const tutorials_public_controller_1 = require("./tutorials.public.controller");
const tutorials_service_1 = require("./tutorials.service");
let TutorialsModule = class TutorialsModule {
};
exports.TutorialsModule = TutorialsModule;
exports.TutorialsModule = TutorialsModule = __decorate([
    (0, common_1.Module)({
        imports: [typeorm_1.TypeOrmModule.forFeature([course_entity_1.Course, course_section_entity_1.CourseSection, lesson_entity_1.Lesson, lesson_page_entity_1.LessonPage, content_block_entity_1.ContentBlock])],
        providers: [tutorials_service_1.TutorialsService],
        controllers: [tutorials_admin_controller_1.TutorialsAdminController, tutorials_public_controller_1.TutorialsPublicController],
    })
], TutorialsModule);
//# sourceMappingURL=tutorials.module.js.map