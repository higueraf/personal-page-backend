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
exports.TutorialsPublicController = void 0;
const common_1 = require("@nestjs/common");
const optional_jwt_guard_1 = require("../auth/optional-jwt.guard");
const tutorials_service_1 = require("./tutorials.service");
let TutorialsPublicController = class TutorialsPublicController {
    constructor(service) {
        this.service = service;
    }
    listTutorials(search) { return this.service.publicTutorials(search); }
    tutorialMeta(slug) { return this.service.publicTutorialMeta(slug); }
    tutorialPages(slug, req) {
        return this.service.publicTutorialPages(slug, req.user);
    }
    tutorialContent(courseSlug, lessonSlug, req) {
        return this.service.publicTutorialContent(courseSlug, lessonSlug, req.user);
    }
    publicCourses(q) { return this.service.publicCourses(q); }
    publicCourse(slug) { return this.service.publicCourse(slug); }
    publicCurriculum(slug) { return this.service.publicCurriculum(slug); }
    publicLessonPage(courseSlug, lessonSlug, pageOrder) {
        return this.service.publicLessonPage(courseSlug, lessonSlug, Number(pageOrder));
    }
};
exports.TutorialsPublicController = TutorialsPublicController;
__decorate([
    (0, common_1.Get)('tutorials'),
    __param(0, (0, common_1.Query)('search')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], TutorialsPublicController.prototype, "listTutorials", null);
__decorate([
    (0, common_1.Get)('tutorials/:slug'),
    __param(0, (0, common_1.Param)('slug')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], TutorialsPublicController.prototype, "tutorialMeta", null);
__decorate([
    (0, common_1.UseGuards)(optional_jwt_guard_1.OptionalJwtAuthGuard),
    (0, common_1.Get)('tutorials/:slug/pages'),
    __param(0, (0, common_1.Param)('slug')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], TutorialsPublicController.prototype, "tutorialPages", null);
__decorate([
    (0, common_1.UseGuards)(optional_jwt_guard_1.OptionalJwtAuthGuard),
    (0, common_1.Get)('tutorials/:courseSlug/pages/:lessonSlug'),
    __param(0, (0, common_1.Param)('courseSlug')),
    __param(1, (0, common_1.Param)('lessonSlug')),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", void 0)
], TutorialsPublicController.prototype, "tutorialContent", null);
__decorate([
    (0, common_1.Get)('courses'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], TutorialsPublicController.prototype, "publicCourses", null);
__decorate([
    (0, common_1.Get)('courses/:slug'),
    __param(0, (0, common_1.Param)('slug')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], TutorialsPublicController.prototype, "publicCourse", null);
__decorate([
    (0, common_1.Get)('courses/:slug/curriculum'),
    __param(0, (0, common_1.Param)('slug')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], TutorialsPublicController.prototype, "publicCurriculum", null);
__decorate([
    (0, common_1.Get)('lessons/:courseSlug/:lessonSlug/pages/:pageOrder'),
    __param(0, (0, common_1.Param)('courseSlug')),
    __param(1, (0, common_1.Param)('lessonSlug')),
    __param(2, (0, common_1.Param)('pageOrder')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", void 0)
], TutorialsPublicController.prototype, "publicLessonPage", null);
exports.TutorialsPublicController = TutorialsPublicController = __decorate([
    (0, common_1.Controller)('public'),
    __metadata("design:paramtypes", [tutorials_service_1.TutorialsService])
], TutorialsPublicController);
//# sourceMappingURL=tutorials.public.controller.js.map