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
exports.VideoSection = void 0;
const typeorm_1 = require("typeorm");
const video_course_entity_1 = require("./video-course.entity");
const video_lesson_entity_1 = require("./video-lesson.entity");
let VideoSection = class VideoSection {
};
exports.VideoSection = VideoSection;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], VideoSection.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => video_course_entity_1.VideoCourse, (course) => course.sections, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'course_id' }),
    __metadata("design:type", video_course_entity_1.VideoCourse)
], VideoSection.prototype, "course", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], VideoSection.prototype, "title", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 1 }),
    __metadata("design:type", Number)
], VideoSection.prototype, "order", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => video_lesson_entity_1.VideoLesson, (lesson) => lesson.section),
    __metadata("design:type", Array)
], VideoSection.prototype, "lessons", void 0);
exports.VideoSection = VideoSection = __decorate([
    (0, typeorm_1.Entity)('video_sections')
], VideoSection);
//# sourceMappingURL=video-section.entity.js.map