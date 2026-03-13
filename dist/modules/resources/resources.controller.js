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
exports.ResourcesPublicController = exports.ResourcesAdminController = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const resource_entity_1 = require("../../entities/resource.entity");
class UpsertResourceDto {
}
let ResourcesAdminController = class ResourcesAdminController {
    constructor(repo) {
        this.repo = repo;
    }
    async list(search, page = '1') {
        const where = {};
        if (search)
            where.title = (0, typeorm_2.ILike)(`%${search}%`);
        const p = Math.max(1, parseInt(page));
        const [data, total] = await this.repo.findAndCount({ where, order: { order: 'ASC', created_at: 'DESC' }, skip: (p - 1) * 20, take: 20 });
        return { data, meta: { total_records: total, page: p, page_size: 20 } };
    }
    async get(id) {
        const item = await this.repo.findOne({ where: { id } });
        return item ? { data: item } : { error: 'Not found' };
    }
    async create(dto) {
        const item = this.repo.create({ ...dto, type: dto.type || resource_entity_1.ResourceType.LINK, order: dto.order ?? 0, is_free: dto.is_free ?? true, is_published: dto.is_published ?? false });
        return { data: await this.repo.save(item) };
    }
    async update(id, dto) {
        const item = await this.repo.findOne({ where: { id } });
        if (!item)
            return { error: 'Not found' };
        Object.assign(item, dto);
        return { data: await this.repo.save(item) };
    }
    async remove(id) { await this.repo.delete(id); }
};
exports.ResourcesAdminController = ResourcesAdminController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)('search')),
    __param(1, (0, common_1.Query)('page')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ResourcesAdminController.prototype, "list", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ResourcesAdminController.prototype, "get", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [UpsertResourceDto]),
    __metadata("design:returntype", Promise)
], ResourcesAdminController.prototype, "create", null);
__decorate([
    (0, common_1.Put)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ResourcesAdminController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ResourcesAdminController.prototype, "remove", null);
exports.ResourcesAdminController = ResourcesAdminController = __decorate([
    (0, common_1.Controller)('resources'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __param(0, (0, typeorm_1.InjectRepository)(resource_entity_1.Resource)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], ResourcesAdminController);
let ResourcesPublicController = class ResourcesPublicController {
    constructor(repo) {
        this.repo = repo;
    }
    async list(search, page = '1', pageSize = '12') {
        const where = { is_published: true };
        if (search)
            where.title = (0, typeorm_2.ILike)(`%${search}%`);
        const p = Math.max(1, parseInt(page));
        const size = Math.min(50, parseInt(pageSize));
        const [data, total] = await this.repo.findAndCount({ where, order: { order: 'ASC', created_at: 'DESC' }, skip: (p - 1) * size, take: size });
        return { data, meta: { total_records: total, page: p, page_size: size } };
    }
};
exports.ResourcesPublicController = ResourcesPublicController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)('search')),
    __param(1, (0, common_1.Query)('page')),
    __param(2, (0, common_1.Query)('page_size')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], ResourcesPublicController.prototype, "list", null);
exports.ResourcesPublicController = ResourcesPublicController = __decorate([
    (0, common_1.Controller)('public/resources'),
    __param(0, (0, typeorm_1.InjectRepository)(resource_entity_1.Resource)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], ResourcesPublicController);
//# sourceMappingURL=resources.controller.js.map