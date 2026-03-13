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
exports.UsersAdminController = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const user_entity_1 = require("../../entities/user.entity");
const role_entity_1 = require("../../entities/role.entity");
class UpdateUserDto {
}
let UsersAdminController = class UsersAdminController {
    constructor(usersRepo, rolesRepo) {
        this.usersRepo = usersRepo;
        this.rolesRepo = rolesRepo;
    }
    async list(page = '1', pageSize = '20', status, search) {
        const p = Math.max(1, parseInt(page));
        const size = Math.min(100, parseInt(pageSize));
        const qb = this.usersRepo
            .createQueryBuilder('u')
            .leftJoinAndSelect('u.role', 'role')
            .orderBy('u.created_at', 'DESC')
            .skip((p - 1) * size)
            .take(size);
        if (status)
            qb.andWhere('u.status = :status', { status });
        if (search) {
            qb.andWhere('(u.email ILIKE :q OR u.first_name ILIKE :q OR u.last_name ILIKE :q)', { q: `%${search}%` });
        }
        const [users, total] = await qb.getManyAndCount();
        return {
            data: users.map((u) => this.serialize(u)),
            meta: { total_records: total, page: p, page_size: size },
        };
    }
    async roles() {
        const roles = await this.rolesRepo.find({ order: { name: 'ASC' } });
        return { data: roles.map((r) => ({ id: r.id, name: r.name })) };
    }
    async update(id, dto) {
        const user = await this.usersRepo.findOne({ where: { id }, relations: ['role'] });
        if (!user)
            return { error: 'Usuario no encontrado' };
        if (dto.status !== undefined)
            user.status = dto.status;
        if (dto.is_active !== undefined)
            user.is_active = dto.is_active;
        if (dto.role_id) {
            const role = await this.rolesRepo.findOne({ where: { id: dto.role_id } });
            if (role)
                user.role = role;
        }
        const saved = await this.usersRepo.save(user);
        return { data: this.serialize(saved) };
    }
    serialize(u) {
        return {
            id: u.id,
            first_name: u.first_name,
            last_name: u.last_name,
            email: u.email,
            status: u.status,
            is_active: u.is_active,
            role: u.role ? { id: u.role.id, name: u.role.name } : null,
            created_at: u.created_at,
        };
    }
};
exports.UsersAdminController = UsersAdminController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)('page')),
    __param(1, (0, common_1.Query)('page_size')),
    __param(2, (0, common_1.Query)('status')),
    __param(3, (0, common_1.Query)('search')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String, String]),
    __metadata("design:returntype", Promise)
], UsersAdminController.prototype, "list", null);
__decorate([
    (0, common_1.Get)('roles'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], UsersAdminController.prototype, "roles", null);
__decorate([
    (0, common_1.Patch)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, UpdateUserDto]),
    __metadata("design:returntype", Promise)
], UsersAdminController.prototype, "update", null);
exports.UsersAdminController = UsersAdminController = __decorate([
    (0, common_1.Controller)('admin/users'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __param(0, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __param(1, (0, typeorm_1.InjectRepository)(role_entity_1.Role)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository])
], UsersAdminController);
//# sourceMappingURL=users-admin.controller.js.map