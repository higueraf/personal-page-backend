"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VideoCoursesAdminController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const video_course_dto_1 = require("./dto/video-course.dto");
const video_courses_service_1 = require("./video-courses.service");
let VideoCoursesAdminController = class VideoCoursesAdminController {
    constructor(service) {
        this.service = service;
    }
    listCourses(q) { return this.service.listCourses(q); }
    getCourse(id) { return this.service.getCourse(id); }
    createCourse(dto) { return this.service.createCourse(dto); }
    updateCourse(id, dto) { return this.service.updateCourse(id, dto); }
    async deleteCourse(id) { await this.service.deleteCourse(id); }
    listSections(q) { return this.service.listSections(q); }
    createSection(dto) { return this.service.createSection(dto); }
    updateSection(id, dto) { return this.service.updateSection(id, dto); }
    async deleteSection(id) { await this.service.deleteSection(id); }
    listLessons(q) { return this.service.listLessons(q); }
    createLesson(dto) { return this.service.createLesson(dto); }
    updateLesson(id, dto) { return this.service.updateLesson(id, dto); }
    async deleteLesson(id) { await this.service.deleteLesson(id); }
};
exports.VideoCoursesAdminController = VideoCoursesAdminController;
__decorate([
    (0, common_1.Get)('video-courses'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], VideoCoursesAdminController.prototype, "listCourses", null);
__decorate([
    (0, common_1.Get)('video-courses/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], VideoCoursesAdminController.prototype, "getCourse", null);
__decorate([
    (0, common_1.Post)('video-courses'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [video_course_dto_1.UpsertVideoCourseDto]),
    __metadata("design:returntype", void 0)
], VideoCoursesAdminController.prototype, "createCourse", null);
__decorate([
    (0, common_1.Put)('video-courses/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], VideoCoursesAdminController.prototype, "updateCourse", null);
__decorate([
    (0, common_1.HttpCode)(204),
    (0, common_1.Delete)('video-courses/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], VideoCoursesAdminController.prototype, "deleteCourse", null);
__decorate([
    (0, common_1.Get)('video-sections'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], VideoCoursesAdminController.prototype, "listSections", null);
__decorate([
    (0, common_1.Post)('video-sections'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [video_course_dto_1.UpsertVideoSectionDto]),
    __metadata("design:returntype", void 0)
], VideoCoursesAdminController.prototype, "createSection", null);
__decorate([
    (0, common_1.Put)('video-sections/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], VideoCoursesAdminController.prototype, "updateSection", null);
__decorate([
    (0, common_1.HttpCode)(204),
    (0, common_1.Delete)('video-sections/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], VideoCoursesAdminController.prototype, "deleteSection", null);
__decorate([
    (0, common_1.Get)('video-lessons'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], VideoCoursesAdminController.prototype, "listLessons", null);
__decorate([
    (0, common_1.Post)('video-lessons'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [video_course_dto_1.UpsertVideoLessonDto]),
    __metadata("design:returntype", void 0)
], VideoCoursesAdminController.prototype, "createLesson", null);
__decorate([
    (0, common_1.Put)('video-lessons/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], VideoCoursesAdminController.prototype, "updateLesson", null);
__decorate([
    (0, common_1.HttpCode)(204),
    (0, common_1.Delete)('video-lessons/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], VideoCoursesAdminController.prototype, "deleteLesson", null);
exports.VideoCoursesAdminController = VideoCoursesAdminController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [video_courses_service_1.VideoCoursesService])
], VideoCoursesAdminController);
//# sourceMappingURL=video-courses.admin.controller.js.map