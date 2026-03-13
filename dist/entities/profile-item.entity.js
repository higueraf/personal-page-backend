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
exports.ProfileItem = exports.ProfileItemType = void 0;
const typeorm_1 = require("typeorm");
var ProfileItemType;
(function (ProfileItemType) {
    ProfileItemType["EXPERIENCE"] = "EXPERIENCE";
    ProfileItemType["EDUCATION"] = "EDUCATION";
    ProfileItemType["CERTIFICATION"] = "CERTIFICATION";
    ProfileItemType["SKILL"] = "SKILL";
    ProfileItemType["LANGUAGE"] = "LANGUAGE";
    ProfileItemType["AWARD"] = "AWARD";
    ProfileItemType["PUBLICATION"] = "PUBLICATION";
    ProfileItemType["VOLUNTEER"] = "VOLUNTEER";
})(ProfileItemType || (exports.ProfileItemType = ProfileItemType = {}));
let ProfileItem = class ProfileItem {
};
exports.ProfileItem = ProfileItem;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], ProfileItem.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'enum', enum: ProfileItemType }),
    __metadata("design:type", String)
], ProfileItem.prototype, "type", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], ProfileItem.prototype, "title", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ProfileItem.prototype, "subtitle", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ProfileItem.prototype, "location", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ProfileItem.prototype, "start_date", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ProfileItem.prototype, "end_date", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], ProfileItem.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'simple-array', nullable: true }),
    __metadata("design:type", Array)
], ProfileItem.prototype, "tags", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ProfileItem.prototype, "url", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ProfileItem.prototype, "logo", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 0 }),
    __metadata("design:type", Number)
], ProfileItem.prototype, "order", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: true }),
    __metadata("design:type", Boolean)
], ProfileItem.prototype, "is_visible", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], ProfileItem.prototype, "created_at", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], ProfileItem.prototype, "updated_at", void 0);
exports.ProfileItem = ProfileItem = __decorate([
    (0, typeorm_1.Entity)('profile_items')
], ProfileItem);
//# sourceMappingURL=profile-item.entity.js.map