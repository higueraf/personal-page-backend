import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PracticeItem } from '../../entities/practice-item.entity';
import { DartFieldType, getVariantConfig } from './practice-variants.config';

function toResponse(item: PracticeItem) {
  return { id: item.id, ...item.data };
}

/**
 * Fuerza un valor recibido del cliente al tipo declarado en
 * `practice-variants.config.ts` para ese campo. Si el valor viene vacío,
 * ausente o con un tipo incompatible (ej. boolean en un campo `string`),
 * se reemplaza por un valor por defecto seguro en vez de guardarse tal cual.
 * Esto evita que datos mal tipados de un alumno contaminen el recurso
 * compartido de la variante para el resto.
 */
function coerceValue(type: DartFieldType, raw: any, label: string): any {
  switch (type) {
    case 'string':
      return typeof raw === 'string' && raw.trim() !== '' ? raw : `Sin ${label.toLowerCase()}`;
    case 'int': {
      const n = Number(raw);
      return Number.isFinite(n) ? Math.trunc(n) : 0;
    }
    case 'double': {
      const n = Number(raw);
      return Number.isFinite(n) ? n : 0;
    }
    case 'bool':
      if (typeof raw === 'boolean') return raw;
      if (typeof raw === 'number') return raw !== 0;
      if (typeof raw === 'string') return raw.toLowerCase() === 'true';
      return false;
  }
}

/**
 * Construye el objeto `data` a guardar a partir del body recibido,
 * quedándose únicamente con los campos declarados para la variante (se
 * descartan typos/campos ajenos como `stok`, `catgeoria`, `hecho`, etc.) y
 * forzando el tipo de cada uno. En updates, `existing` provee el valor
 * previo para los campos que no vienen en el body (merge parcial real).
 */
export function sanitizeData(
  type: string,
  incoming: Record<string, any>,
  existing?: Record<string, any>,
): Record<string, any> {
  const { fields } = getVariantConfig(type);
  const data: Record<string, any> = {};
  for (const field of fields) {
    const raw = Object.prototype.hasOwnProperty.call(incoming, field.key)
      ? incoming[field.key]
      : existing?.[field.key];
    data[field.key] = coerceValue(field.type, raw, field.label);
  }
  return data;
}

// Regla de negocio nueva (distinta a Flutter/React, que hoy son CRUD 100%
// genérico): estas variantes exigen unicidad de un campo al crear/editar.
const UNIQUE_FIELD_BY_VARIANT: Record<string, string> = {
  vehiculos: 'placa',
  mascotas: 'codigo',
};

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
    await this.ensureSeeded(type);
    const { id, type: _ignored, ...incoming } = body ?? {};
    const data = sanitizeData(type, incoming);
    await this.assertUnique(type, data, null);
    const item = this.itemRepo.create({ type, data });
    return toResponse(await this.itemRepo.save(item));
  }

  async update(type: string, id: string, body: Record<string, any>) {
    const existing = await this.itemRepo.findOne({ where: { id, type } });
    if (!existing) throw new NotFoundException('Ítem no encontrado');
    const { id: _ignoredId, type: _ignoredType, ...incoming } = body ?? {};
    const merged = sanitizeData(type, incoming, existing.data);
    await this.assertUnique(type, merged, id);
    existing.data = merged;
    return toResponse(await this.itemRepo.save(existing));
  }

  async remove(type: string, id: string) {
    const existing = await this.itemRepo.findOne({ where: { id, type } });
    if (!existing) throw new NotFoundException('Ítem no encontrado');
    if (type === 'restaurante' && existing.data?.disponible === true) {
      throw new BadRequestException(
        'No se puede eliminar un plato disponible; márcalo como no disponible primero.',
      );
    }
    await this.itemRepo.delete(id);
    return { success: true };
  }

  async reset(type: string) {
    await this.itemRepo.delete({ type });
    await this.ensureSeeded(type);
    return this.list(type);
  }

  /** Filtra los registros con `disponible === true` (variantes `vehiculos`/`mascotas`). */
  async disponibles(type: string) {
    await this.ensureSeeded(type);
    const items = await this.itemRepo.find({ where: { type }, order: { created_at: 'ASC' } });
    return items.filter((i) => i.data?.disponible === true).map(toResponse);
  }

  /** Resumen agregado (variante `restaurante`): total, precio promedio y destacados. */
  async resumen(type: string) {
    await this.ensureSeeded(type);
    const items = await this.itemRepo.find({ where: { type } });
    const total = items.length;
    const precios = items.map((i) => Number(i.data?.precio) || 0);
    const precioPromedio = total ? precios.reduce((a, b) => a + b, 0) / total : 0;
    const destacados = items.filter((i) => i.data?.destacado === true).length;
    return { total, precioPromedio: Math.round(precioPromedio * 100) / 100, destacados };
  }

  private async assertUnique(type: string, data: Record<string, any>, excludeId: string | null) {
    const field = UNIQUE_FIELD_BY_VARIANT[type];
    if (!field || data[field] == null) return;
    const siblings = await this.itemRepo.find({ where: { type } });
    const duplicate = siblings.find(
      (s) =>
        s.id !== excludeId &&
        String(s.data?.[field]).toLowerCase() === String(data[field]).toLowerCase(),
    );
    if (duplicate) {
      const label = field === 'placa' ? 'esa placa' : 'ese código';
      throw new ConflictException(`Ya existe un registro con ${label}.`);
    }
  }
}
