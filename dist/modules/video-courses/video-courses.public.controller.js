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
exports.VideoCoursesPublicController = void 0;
const common_1 = require("@nestjs/common");
const optional_jwt_guard_1 = require("../auth/optional-jwt.guard");
const video_courses_service_1 = require("./video-courses.service");
let VideoCoursesPublicController = class VideoCoursesPublicController {
    constructor(service) {
        this.service = service;
    }
    list(search) { return this.service.publicList(search); }
    meta(slug) { return this.service.publicMeta(slug); }
    lesson(courseSlug, lessonSlug, req) {
        return this.service.publicLesson(courseSlug, lessonSlug, req.user);
    }
};
exports.VideoCoursesPublicController = VideoCoursesPublicController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)('search')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], VideoCoursesPublicController.prototype, "list", null);
__decorate([
    (0, common_1.Get)(':slug'),
    __param(0, (0, common_1.Param)('slug')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], VideoCoursesPublicController.prototype, "meta", null);
__decorate([
    (0, common_1.UseGuards)(optional_jwt_guard_1.OptionalJwtAuthGuard),
    (0, common_1.Get)(':courseSlug/lessons/:lessonSlug'),
    __param(0, (0, common_1.Param)('courseSlug')),
    __param(1, (0, common_1.Param)('lessonSlug')),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", void 0)
], VideoCoursesPublicController.prototype, "lesson", null);
exports.VideoCoursesPublicController = VideoCoursesPublicController = __decorate([
    (0, common_1.Controller)('public/video-courses'),
    __metadata("design:paramtypes", [video_courses_service_1.VideoCoursesService])
], VideoCoursesPublicController);
//# sourceMappingURL=video-courses.public.controller.js.map