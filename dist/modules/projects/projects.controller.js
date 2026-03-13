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
exports.ProjectsModule = exports.ProjectsPublicController = exports.ProjectsAdminController = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const project_entity_1 = require("../../entities/project.entity");
const slug_util_1 = require("../../common/slug.util");
class UpsertProjectDto {
}
let ProjectsAdminController = class ProjectsAdminController {
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
        if (!item)
            return { error: 'Not found' };
        return { data: item };
    }
    async create(dto) {
        const item = this.repo.create({ ...dto, slug: dto.slug || (0, slug_util_1.toSlug)(dto.title), status: dto.status || project_entity_1.ProjectStatus.DRAFT, order: dto.order ?? 0 });
        return { data: await this.repo.save(item) };
    }
    async update(id, dto) {
        const item = await this.repo.findOne({ where: { id } });
        if (!item)
            return { error: 'Not found' };
        if (dto.title && !dto.slug)
            dto.slug = (0, slug_util_1.toSlug)(dto.title);
        Object.assign(item, dto);
        return { data: await this.repo.save(item) };
    }
    async remove(id) {
        await this.repo.delete(id);
    }
};
exports.ProjectsAdminController = ProjectsAdminController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)('search')),
    __param(1, (0, common_1.Query)('page')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ProjectsAdminController.prototype, "list", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ProjectsAdminController.prototype, "get", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [UpsertProjectDto]),
    __metadata("design:returntype", Promise)
], ProjectsAdminController.prototype, "create", null);
__decorate([
    (0, common_1.Put)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ProjectsAdminController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ProjectsAdminController.prototype, "remove", null);
exports.ProjectsAdminController = ProjectsAdminController = __decorate([
    (0, common_1.Controller)('projects'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __param(0, (0, typeorm_1.InjectRepository)(project_entity_1.Project)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], ProjectsAdminController);
let ProjectsPublicController = class ProjectsPublicController {
    constructor(repo) {
        this.repo = repo;
    }
    async list(search, page = '1', pageSize = '12') {
        const where = { status: project_entity_1.ProjectStatus.PUBLISHED };
        if (search)
            where.title = (0, typeorm_2.ILike)(`%${search}%`);
        const p = Math.max(1, parseInt(page));
        const size = Math.min(50, parseInt(pageSize));
        const [data, total] = await this.repo.findAndCount({ where, order: { order: 'ASC', created_at: 'DESC' }, skip: (p - 1) * size, take: size });
        return { data, meta: { total_records: total, page: p, page_size: size } };
    }
    async featured() {
        const data = await this.repo.find({ where: { status: project_entity_1.ProjectStatus.PUBLISHED }, order: { order: 'ASC', created_at: 'DESC' }, take: 3 });
        return { data };
    }
    async get(slug) {
        const item = await this.repo.findOne({ where: { slug, status: project_entity_1.ProjectStatus.PUBLISHED } });
        if (!item)
            return { error: 'Not found' };
        return { data: item };
    }
};
exports.ProjectsPublicController = ProjectsPublicController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)('search')),
    __param(1, (0, common_1.Query)('page')),
    __param(2, (0, common_1.Query)('page_size')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], ProjectsPublicController.prototype, "list", null);
__decorate([
    (0, common_1.Get)('featured'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ProjectsPublicController.prototype, "featured", null);
__decorate([
    (0, common_1.Get)(':slug'),
    __param(0, (0, common_1.Param)('slug')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ProjectsPublicController.prototype, "get", null);
exports.ProjectsPublicController = ProjectsPublicController = __decorate([
    (0, common_1.Controller)('public/projects'),
    __param(0, (0, typeorm_1.InjectRepository)(project_entity_1.Project)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], ProjectsPublicController);
let ProjectsModule = class ProjectsModule {
};
exports.ProjectsModule = ProjectsModule;
exports.ProjectsModule = ProjectsModule = __decorate([
    (0, common_1.Controller)('projects')
], ProjectsModule);
//# sourceMappingURL=projects.controller.js.map