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
exports.TutorialsAdminController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const tutorials_service_1 = require("./tutorials.service");
const tutorial_dto_1 = require("./dto/tutorial.dto");
let TutorialsAdminController = class TutorialsAdminController {
    constructor(service) {
        this.service = service;
    }
    listCourses(q) { return this.service.listCourses(q); }
    getCourse(id) { return this.service.getCourse(id); }
    createCourse(dto) { return this.service.createCourse(dto); }
    updateCourse(id, dto) { return this.service.updateCourse(id, dto); }
    async deleteCourse(id) { await this.service.deleteCourse(id); }
    listSections(q) { return this.service.listSections(q); }
    getSection(id) { return this.service.getSection(id); }
    createSection(dto) { return this.service.createSection(dto); }
    updateSection(id, dto) { return this.service.updateSection(id, dto); }
    async deleteSection(id) { await this.service.deleteSection(id); }
    listLessons(q) { return this.service.listLessons(q); }
    getLesson(id) { return this.service.getLesson(id); }
    createLesson(dto) { return this.service.createLesson(dto); }
    updateLesson(id, dto) { return this.service.updateLesson(id, dto); }
    async deleteLesson(id) { await this.service.deleteLesson(id); }
    listPages(q) { return this.service.listPages(q); }
    getPage(id) { return this.service.getPage(id); }
    createPage(dto) { return this.service.createPage(dto); }
    updatePage(id, dto) { return this.service.updatePage(id, dto); }
    async deletePage(id) { await this.service.deletePage(id); }
    listBlocks(q) { return this.service.listBlocks(q); }
    getBlock(id) { return this.service.getBlock(id); }
    createBlock(dto) { return this.service.createBlock(dto); }
    updateBlock(id, dto) { return this.service.updateBlock(id, dto); }
    async deleteBlock(id) { await this.service.deleteBlock(id); }
};
exports.TutorialsAdminController = TutorialsAdminController;
__decorate([
    (0, common_1.Get)('courses'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], TutorialsAdminController.prototype, "listCourses", null);
__decorate([
    (0, common_1.Get)('courses/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], TutorialsAdminController.prototype, "getCourse", null);
__decorate([
    (0, common_1.Post)('courses'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [tutorial_dto_1.UpsertCourseDto]),
    __metadata("design:returntype", void 0)
], TutorialsAdminController.prototype, "createCourse", null);
__decorate([
    (0, common_1.Put)('courses/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], TutorialsAdminController.prototype, "updateCourse", null);
__decorate([
    (0, common_1.HttpCode)(204),
    (0, common_1.Delete)('courses/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], TutorialsAdminController.prototype, "deleteCourse", null);
__decorate([
    (0, common_1.Get)('course-sections'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], TutorialsAdminController.prototype, "listSections", null);
__decorate([
    (0, common_1.Get)('course-sections/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], TutorialsAdminController.prototype, "getSection", null);
__decorate([
    (0, common_1.Post)('course-sections'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [tutorial_dto_1.UpsertSectionDto]),
    __metadata("design:returntype", void 0)
], TutorialsAdminController.prototype, "createSection", null);
__decorate([
    (0, common_1.Put)('course-sections/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], TutorialsAdminController.prototype, "updateSection", null);
__decorate([
    (0, common_1.HttpCode)(204),
    (0, common_1.Delete)('course-sections/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], TutorialsAdminController.prototype, "deleteSection", null);
__decorate([
    (0, common_1.Get)('lessons'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], TutorialsAdminController.prototype, "listLessons", null);
__decorate([
    (0, common_1.Get)('lessons/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], TutorialsAdminController.prototype, "getLesson", null);
__decorate([
    (0, common_1.Post)('lessons'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [tutorial_dto_1.UpsertLessonDto]),
    __metadata("design:returntype", void 0)
], TutorialsAdminController.prototype, "createLesson", null);
__decorate([
    (0, common_1.Put)('lessons/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], TutorialsAdminController.prototype, "updateLesson", null);
__decorate([
    (0, common_1.HttpCode)(204),
    (0, common_1.Delete)('lessons/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], TutorialsAdminController.prototype, "deleteLesson", null);
__decorate([
    (0, common_1.Get)('lesson-pages'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], TutorialsAdminController.prototype, "listPages", null);
__decorate([
    (0, common_1.Get)('lesson-pages/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], TutorialsAdminController.prototype, "getPage", null);
__decorate([
    (0, common_1.Post)('lesson-pages'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [tutorial_dto_1.UpsertPageDto]),
    __metadata("design:returntype", void 0)
], TutorialsAdminController.prototype, "createPage", null);
__decorate([
    (0, common_1.Put)('lesson-pages/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], TutorialsAdminController.prototype, "updatePage", null);
__decorate([
    (0, common_1.HttpCode)(204),
    (0, common_1.Delete)('lesson-pages/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], TutorialsAdminController.prototype, "deletePage", null);
__decorate([
    (0, common_1.Get)('content-blocks'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], TutorialsAdminController.prototype, "listBlocks", null);
__decorate([
    (0, common_1.Get)('content-blocks/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], TutorialsAdminController.prototype, "getBlock", null);
__decorate([
    (0, common_1.Post)('content-blocks'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [tutorial_dto_1.UpsertBlockDto]),
    __metadata("design:returntype", void 0)
], TutorialsAdminController.prototype, "createBlock", null);
__decorate([
    (0, common_1.Put)('content-blocks/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], TutorialsAdminController.prototype, "updateBlock", null);
__decorate([
    (0, common_1.HttpCode)(204),
    (0, common_1.Delete)('content-blocks/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], TutorialsAdminController.prototype, "deleteBlock", null);
exports.TutorialsAdminController = TutorialsAdminController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [tutorials_service_1.TutorialsService])
], TutorialsAdminController);
//# sourceMappingURL=tutorials.admin.controller.js.map