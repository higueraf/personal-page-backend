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
exports.ProfilePublicController = exports.ProfileAdminController = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const profile_item_entity_1 = require("../../entities/profile-item.entity");
class UpsertProfileItemDto {
}
let ProfileAdminController = class ProfileAdminController {
    constructor(repo) {
        this.repo = repo;
    }
    async list(type) {
        const where = {};
        if (type)
            where.type = type;
        const data = await this.repo.find({ where, order: { order: 'ASC', created_at: 'DESC' } });
        return { data };
    }
    async get(id) {
        const item = await this.repo.findOne({ where: { id } });
        return item ? { data: item } : { error: 'Not found' };
    }
    async create(dto) {
        const item = this.repo.create({ ...dto, order: dto.order ?? 0, is_visible: dto.is_visible ?? true });
        return { data: await this.repo.save(item) };
    }
    async update(id, dto) {
        const item = await this.repo.findOne({ where: { id } });
        if (!item)
            return { error: 'Not found' };
        Object.assign(item, dto);
        return { data: await this.repo.save(item) };
    }
    async remove(id) {
        await this.repo.delete(id);
    }
};
exports.ProfileAdminController = ProfileAdminController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)('type')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ProfileAdminController.prototype, "list", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ProfileAdminController.prototype, "get", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [UpsertProfileItemDto]),
    __metadata("design:returntype", Promise)
], ProfileAdminController.prototype, "create", null);
__decorate([
    (0, common_1.Put)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ProfileAdminController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ProfileAdminController.prototype, "remove", null);
exports.ProfileAdminController = ProfileAdminController = __decorate([
    (0, common_1.Controller)('profile'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __param(0, (0, typeorm_1.InjectRepository)(profile_item_entity_1.ProfileItem)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], ProfileAdminController);
let ProfilePublicController = class ProfilePublicController {
    constructor(repo) {
        this.repo = repo;
    }
    async all(type) {
        const where = { is_visible: true };
        if (type)
            where.type = type;
        const data = await this.repo.find({ where, order: { order: 'ASC' } });
        return { data };
    }
};
exports.ProfilePublicController = ProfilePublicController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)('type')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ProfilePublicController.prototype, "all", null);
exports.ProfilePublicController = ProfilePublicController = __decorate([
    (0, common_1.Controller)('public/profile'),
    __param(0, (0, typeorm_1.InjectRepository)(profile_item_entity_1.ProfileItem)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], ProfilePublicController);
//# sourceMappingURL=profile.controller.js.map