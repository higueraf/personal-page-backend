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
exports.VideoLesson = void 0;
const typeorm_1 = require("typeorm");
const video_section_entity_1 = require("./video-section.entity");
let VideoLesson = class VideoLesson {
};
exports.VideoLesson = VideoLesson;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], VideoLesson.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => video_section_entity_1.VideoSection, (section) => section.lessons, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'section_id' }),
    __metadata("design:type", video_section_entity_1.VideoSection)
], VideoLesson.prototype, "section", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], VideoLesson.prototype, "title", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], VideoLesson.prototype, "slug", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 1 }),
    __metadata("design:type", Number)
], VideoLesson.prototype, "order", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 'DRAFT' }),
    __metadata("design:type", String)
], VideoLesson.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 'none' }),
    __metadata("design:type", String)
], VideoLesson.prototype, "video_type", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], VideoLesson.prototype, "video_url", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], VideoLesson.prototype, "video_file", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 0 }),
    __metadata("design:type", Number)
], VideoLesson.prototype, "duration_seconds", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', default: '' }),
    __metadata("design:type", String)
], VideoLesson.prototype, "markdown", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: false }),
    __metadata("design:type", Boolean)
], VideoLesson.prototype, "is_free_preview", void 0);
exports.VideoLesson = VideoLesson = __decorate([
    (0, typeorm_1.Entity)('video_lessons')
], VideoLesson);
//# sourceMappingURL=video-lesson.entity.js.map