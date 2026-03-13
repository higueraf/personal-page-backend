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
Object.defineProperty(exports, "__esModule", { value: true });
exports.LessonPage = void 0;
const typeorm_1 = require("typeorm");
const lesson_entity_1 = require("./lesson.entity");
const content_block_entity_1 = require("./content-block.entity");
let LessonPage = class LessonPage {
};
exports.LessonPage = LessonPage;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], LessonPage.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => lesson_entity_1.Lesson, (lesson) => lesson.pages, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'lesson_id' }),
    __metadata("design:type", lesson_entity_1.Lesson)
], LessonPage.prototype, "lesson", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], LessonPage.prototype, "title", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 1 }),
    __metadata("design:type", Number)
], LessonPage.prototype, "order", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 5 }),
    __metadata("design:type", Number)
], LessonPage.prototype, "estimated_minutes", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 'DRAFT' }),
    __metadata("design:type", String)
], LessonPage.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => content_block_entity_1.ContentBlock, (block) => block.page),
    __metadata("design:type", Array)
], LessonPage.prototype, "blocks", void 0);
exports.LessonPage = LessonPage = __decorate([
    (0, typeorm_1.Entity)('lesson_pages')
], LessonPage);
//# sourceMappingURL=lesson-page.entity.js.map