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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const jwt_1 = require("@nestjs/jwt");
const typeorm_2 = require("typeorm");
const bcrypt_1 = __importDefault(require("bcrypt"));
const user_entity_1 = require("../../entities/user.entity");
const role_entity_1 = require("../../entities/role.entity");
let AuthService = class AuthService {
    constructor(usersRepo, rolesRepo, jwtService) {
        this.usersRepo = usersRepo;
        this.rolesRepo = rolesRepo;
        this.jwtService = jwtService;
    }
    async validateUser(email, password) {
        const user = await this.usersRepo.findOne({
            where: { email },
            relations: ['role'],
        });
        if (!user)
            throw new common_1.UnauthorizedException('Credenciales inválidas');
        const ok = await bcrypt_1.default.compare(password, user.password_hash);
        if (!ok)
            throw new common_1.UnauthorizedException('Credenciales inválidas');
        if (user.status === user_entity_1.UserStatus.PENDING) {
            throw new common_1.ForbiddenException('Tu cuenta está pendiente de aprobación por el administrador.');
        }
        if (user.status === user_entity_1.UserStatus.SUSPENDED) {
            throw new common_1.ForbiddenException('Tu cuenta ha sido suspendida. Contacta al administrador.');
        }
        if (user.status === user_entity_1.UserStatus.REJECTED) {
            throw new common_1.ForbiddenException('Tu solicitud de registro fue denegada.');
        }
        if (!user.is_active) {
            throw new common_1.ForbiddenException('Tu cuenta está desactivada.');
        }
        return user;
    }
    sign(user) {
        return this.jwtService.sign({
            sub: user.id,
            email: user.email,
            role: user.role?.name || null,
        });
    }
    async register(dto) {
        if (dto.password !== dto.password_confirm) {
            throw new common_1.BadRequestException('Las contraseñas no coinciden');
        }
        const exists = await this.usersRepo.findOne({ where: { email: dto.email } });
        if (exists)
            throw new common_1.BadRequestException('El email ya está registrado');
        const studentRole = await this.rolesRepo.findOne({ where: { name: 'student' } });
        if (!studentRole)
            throw new common_1.BadRequestException('Configuración interna inválida');
        const password_hash = await bcrypt_1.default.hash(dto.password, 10);
        const user = this.usersRepo.create({
            first_name: dto.first_name,
            last_name: dto.last_name,
            email: dto.email,
            password_hash,
            role: studentRole,
            status: user_entity_1.UserStatus.PENDING,
            is_active: true,
        });
        const saved = await this.usersRepo.save(user);
        return this.publicUser(saved);
    }
    async findUserForJwt(id) {
        return this.usersRepo.findOne({
            where: { id },
            relations: ['role'],
        });
    }
    publicUser(user) {
        return {
            id: user.id,
            first_name: user.first_name,
            last_name: user.last_name,
            email: user.email,
            role: user.role
                ? { name: user.role.name, permissions: user.role.permissions || [] }
                : null,
            permissions: user.role?.permissions || [],
            status: user.status,
            is_active: user.is_active,
        };
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __param(1, (0, typeorm_1.InjectRepository)(role_entity_1.Role)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        jwt_1.JwtService])
], AuthService);
//# sourceMappingURL=auth.service.js.map