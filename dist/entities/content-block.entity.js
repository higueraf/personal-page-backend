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
exports.ContentBlock = void 0;
const typeorm_1 = require("typeorm");
const lesson_page_entity_1 = require("./lesson-page.entity");
let ContentBlock = class ContentBlock {
};
exports.ContentBlock = ContentBlock;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], ContentBlock.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => lesson_page_entity_1.LessonPage, (page) => page.blocks, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'page_id' }),
    __metadata("design:type", lesson_page_entity_1.LessonPage)
], ContentBlock.prototype, "page", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], ContentBlock.prototype, "type", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 1 }),
    __metadata("design:type", Number)
], ContentBlock.prototype, "order", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', default: () => "'{}'" }),
    __metadata("design:type", Object)
], ContentBlock.prototype, "data", void 0);
exports.ContentBlock = ContentBlock = __decorate([
    (0, typeorm_1.Entity)('content_blocks')
], ContentBlock);
//# sourceMappingURL=content-block.entity.js.map