import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PracticeItem } from '../../entities/practice-item.entity';
import { getVariantConfig } from './practice-variants.config';

function toResponse(item: PracticeItem) {
  return { id: item.id, ...item.data };
}

@Injectable()
export class PracticeApiService {
  constructor(
    @InjectRepository(PracticeItem)
    private itemRepo: Repository<PracticeItem>,
  ) {}

  private async ensureSeeded(type: string) {
    const count = await this.itemRepo.count({ where: { type } });
    if (count > 0) return;
    const rows = getVariantConfig(type).seeds.map((data) =>
      this.itemRepo.create({ type, data }),
    );
    await this.itemRepo.save(rows);
  }

  async list(type: string) {
    await this.ensureSeeded(type);
    const items = await this.itemRepo.find({ where: { type }, order: { created_at: 'ASC' } });
    return items.map(toResponse);
  }

  async getOne(type: string, id: string) {
    const item = await this.itemRepo.findOne({ where: { id, type } });
    if (!item) throw new NotFoundException('Ítem no encontrado');
    return toResponse(item);
  }

  async create(type: string, body: Record<string, any>) {
    const { id, type: _ignored, ...data } = body ?? {};
    const item = this.itemRepo.create({ type, data });
    return toResponse(await this.itemRepo.save(item));
  }

  async update(type: string, id: string, body: Record<string, any>) {
    const existing = await this.itemRepo.findOne({ where: { id, type } });
    if (!existing) throw new NotFoundException('Ítem no encontrado');
    const { id: _ignoredId, type: _ignoredType, ...data } = body ?? {};
    existing.data = { ...existing.data, ...data };
    return toResponse(await this.itemRepo.save(existing));
  }

  async remove(type: string, id: string) {
    const existing = await this.itemRepo.findOne({ where: { id, type } });
    if (!existing) throw new NotFoundException('Ítem no encontrado');
    await this.itemRepo.delete(id);
    return { success: true };
  }

  async reset(type: string) {
    await this.itemRepo.delete({ type });
    await this.ensureSeeded(type);
    return this.list(type);
  }
}
