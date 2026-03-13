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
exports.ContactAdminController = exports.ContactPublicController = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const contact_info_entity_1 = require("../../entities/contact-info.entity");
const contact_message_entity_1 = require("../../entities/contact-message.entity");
class SendMessageDto {
}
class UpsertContactInfoDto {
}
let ContactPublicController = class ContactPublicController {
    constructor(infoRepo, msgRepo) {
        this.infoRepo = infoRepo;
        this.msgRepo = msgRepo;
    }
    async info() {
        const data = await this.infoRepo.find({ where: { is_visible: true }, order: { order: 'ASC' } });
        return { data };
    }
    async send(dto) {
        const msg = this.msgRepo.create({ ...dto, status: contact_message_entity_1.ContactMessageStatus.PENDING });
        const saved = await this.msgRepo.save(msg);
        return { data: { id: saved.id, ok: true } };
    }
};
exports.ContactPublicController = ContactPublicController;
__decorate([
    (0, common_1.Get)('info'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ContactPublicController.prototype, "info", null);
__decorate([
    (0, common_1.Post)('message'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [SendMessageDto]),
    __metadata("design:returntype", Promise)
], ContactPublicController.prototype, "send", null);
exports.ContactPublicController = ContactPublicController = __decorate([
    (0, common_1.Controller)('public/contact'),
    __param(0, (0, typeorm_1.InjectRepository)(contact_info_entity_1.ContactInfo)),
    __param(1, (0, typeorm_1.InjectRepository)(contact_message_entity_1.ContactMessage)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository])
], ContactPublicController);
let ContactAdminController = class ContactAdminController {
    constructor(infoRepo, msgRepo) {
        this.infoRepo = infoRepo;
        this.msgRepo = msgRepo;
    }
    async listInfo() {
        const data = await this.infoRepo.find({ order: { order: 'ASC' } });
        return { data };
    }
    async upsertInfo(dto) {
        let item = await this.infoRepo.findOne({ where: { key: dto.key } });
        if (item) {
            Object.assign(item, dto);
        }
        else {
            item = this.infoRepo.create({ ...dto, order: dto.order ?? 0, is_visible: dto.is_visible ?? true });
        }
        return { data: await this.infoRepo.save(item) };
    }
    async updateInfo(id, dto) {
        const item = await this.infoRepo.findOne({ where: { id } });
        if (!item)
            return { error: 'Not found' };
        Object.assign(item, dto);
        return { data: await this.infoRepo.save(item) };
    }
    async listMessages(status, page = '1') {
        const where = {};
        if (status)
            where.status = status;
        const p = Math.max(1, parseInt(page));
        const [data, total] = await this.msgRepo.findAndCount({ where, order: { created_at: 'DESC' }, skip: (p - 1) * 20, take: 20 });
        return { data, meta: { total_records: total, page: p, page_size: 20 } };
    }
    async getMessage(id) {
        const item = await this.msgRepo.findOne({ where: { id } });
        if (!item)
            return { error: 'Not found' };
        if (item.status === contact_message_entity_1.ContactMessageStatus.PENDING) {
            item.status = contact_message_entity_1.ContactMessageStatus.READ;
            await this.msgRepo.save(item);
        }
        return { data: item };
    }
    async updateMessage(id, body) {
        const item = await this.msgRepo.findOne({ where: { id } });
        if (!item)
            return { error: 'Not found' };
        item.status = body.status;
        return { data: await this.msgRepo.save(item) };
    }
};
exports.ContactAdminController = ContactAdminController;
__decorate([
    (0, common_1.Get)('info'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ContactAdminController.prototype, "listInfo", null);
__decorate([
    (0, common_1.Post)('info'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [UpsertContactInfoDto]),
    __metadata("design:returntype", Promise)
], ContactAdminController.prototype, "upsertInfo", null);
__decorate([
    (0, common_1.Patch)('info/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ContactAdminController.prototype, "updateInfo", null);
__decorate([
    (0, common_1.Get)('messages'),
    __param(0, (0, common_1.Query)('status')),
    __param(1, (0, common_1.Query)('page')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ContactAdminController.prototype, "listMessages", null);
__decorate([
    (0, common_1.Get)('messages/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ContactAdminController.prototype, "getMessage", null);
__decorate([
    (0, common_1.Patch)('messages/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ContactAdminController.prototype, "updateMessage", null);
exports.ContactAdminController = ContactAdminController = __decorate([
    (0, common_1.Controller)('contact'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __param(0, (0, typeorm_1.InjectRepository)(contact_info_entity_1.ContactInfo)),
    __param(1, (0, typeorm_1.InjectRepository)(contact_message_entity_1.ContactMessage)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository])
], ContactAdminController);
//# sourceMappingURL=contact.controller.js.map