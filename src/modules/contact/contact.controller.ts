import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ContactInfo } from '../../entities/contact-info.entity';
import { ContactMessage, ContactMessageStatus } from '../../entities/contact-message.entity';

class SendMessageDto {
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
}

class UpsertContactInfoDto {
  key: string;
  label: string;
  value: string;
  icon?: string;
  is_visible?: boolean;
  order?: number;
}

// ── Público ───────────────────────────────────────────────────────────────────

@Controller('public/contact')
export class ContactPublicController {
  constructor(
    @InjectRepository(ContactInfo) private infoRepo: Repository<ContactInfo>,
    @InjectRepository(ContactMessage) private msgRepo: Repository<ContactMessage>,
  ) {}

  @Get('info')
  async info() {
    const data = await this.infoRepo.find({ where: { is_visible: true }, order: { order: 'ASC' } });
    return { data };
  }

  @Post('message')
  async send(@Body() dto: SendMessageDto) {
    const msg = this.msgRepo.create({ ...dto, status: ContactMessageStatus.PENDING });
    const saved = await this.msgRepo.save(msg);
    return { data: { id: saved.id, ok: true } };
  }
}

// ── Admin ─────────────────────────────────────────────────────────────────────

@Controller('contact')
@UseGuards(JwtAuthGuard)
export class ContactAdminController {
  constructor(
    @InjectRepository(ContactInfo) private infoRepo: Repository<ContactInfo>,
    @InjectRepository(ContactMessage) private msgRepo: Repository<ContactMessage>,
  ) {}

  // ── Info de contacto ───────────────────────────────────────────────────────
  @Get('info')
  async listInfo() {
    const data = await this.infoRepo.find({ order: { order: 'ASC' } });
    return { data };
  }

  @Post('info')
  async upsertInfo(@Body() dto: UpsertContactInfoDto) {
    let item = await this.infoRepo.findOne({ where: { key: dto.key } });
    if (item) {
      Object.assign(item, dto);
    } else {
      item = this.infoRepo.create({ ...dto, order: dto.order ?? 0, is_visible: dto.is_visible ?? true });
    }
    return { data: await this.infoRepo.save(item) };
  }

  @Patch('info/:id')
  async updateInfo(@Param('id') id: string, @Body() dto: Partial<UpsertContactInfoDto>) {
    const item = await this.infoRepo.findOne({ where: { id } });
    if (!item) return { error: 'Not found' };
    Object.assign(item, dto);
    return { data: await this.infoRepo.save(item) };
  }

  // ── Mensajes ───────────────────────────────────────────────────────────────
  @Get('messages')
  async listMessages(@Query('status') status?: string, @Query('page') page = '1') {
    const where: any = {};
    if (status) where.status = status;
    const p = Math.max(1, parseInt(page));
    const [data, total] = await this.msgRepo.findAndCount({ where, order: { created_at: 'DESC' }, skip: (p - 1) * 20, take: 20 });
    return { data, meta: { total_records: total, page: p, page_size: 20 } };
  }

  @Get('messages/:id')
  async getMessage(@Param('id') id: string) {
    const item = await this.msgRepo.findOne({ where: { id } });
    if (!item) return { error: 'Not found' };
    // Auto-marcar como leído al abrir
    if (item.status === ContactMessageStatus.PENDING) {
      item.status = ContactMessageStatus.READ;
      await this.msgRepo.save(item);
    }
    return { data: item };
  }

  @Patch('messages/:id')
  async updateMessage(@Param('id') id: string, @Body() body: { status: ContactMessageStatus }) {
    const item = await this.msgRepo.findOne({ where: { id } });
    if (!item) return { error: 'Not found' };
    item.status = body.status;
    return { data: await this.msgRepo.save(item) };
  }
}
