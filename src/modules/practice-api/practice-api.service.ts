import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PracticeItem } from '../../entities/practice-item.entity';

interface DemoSeed {
  name: string;
  description?: string;
  category?: string;
  price: number;
  quantity: number;
}

/** Datos demo por variante de examen — se usan solo para poblar un `type` la primera vez que se consulta. */
const DEMO_SEEDS: Record<string, DemoSeed[]> = {
  ropa: [
    { name: 'Camiseta básica', category: 'Camisetas', price: 12.5, quantity: 30 },
    { name: 'Jean clásico', category: 'Pantalones', price: 28.0, quantity: 15 },
    { name: 'Chompa deportiva', category: 'Abrigos', price: 35.0, quantity: 8 },
    { name: 'Gorra', category: 'Accesorios', price: 8.0, quantity: 25 },
    { name: 'Zapatillas urbanas', category: 'Calzado', price: 45.0, quantity: 0 },
  ],
  libros: [
    { name: 'Cien años de soledad', category: 'Novela', price: 15.0, quantity: 5 },
    { name: 'Clean Code', category: 'Tecnología', price: 22.0, quantity: 3 },
    { name: 'El Principito', category: 'Infantil', price: 9.5, quantity: 0 },
    { name: 'Sapiens', category: 'Ensayo', price: 18.0, quantity: 7 },
    { name: 'Cálculo I', category: 'Educativo', price: 25.0, quantity: 2 },
  ],
  farmacia: [
    { name: 'Paracetamol 500mg', category: 'Analgésico', price: 3.5, quantity: 40 },
    { name: 'Ibuprofeno 400mg', category: 'Antiinflamatorio', price: 4.2, quantity: 3 },
    { name: 'Amoxicilina 500mg', category: 'Antibiótico', price: 6.8, quantity: 2 },
    { name: 'Vitamina C', category: 'Suplemento', price: 5.0, quantity: 50 },
    { name: 'Alcohol antiséptico', category: 'Higiene', price: 2.0, quantity: 4 },
  ],
  tareas: [
    { name: 'Terminar informe de proyecto', description: 'Entregar antes del viernes', price: 0, quantity: 1 },
    { name: 'Estudiar para el examen', description: 'Repasar capítulos 1 a 4', price: 0, quantity: 1 },
    { name: 'Comprar materiales', description: 'Cartulinas y marcadores', price: 0, quantity: 1 },
    { name: 'Reunión con el equipo', description: 'Coordinar entregable final', price: 0, quantity: 1 },
    { name: 'Revisar correos pendientes', price: 0, quantity: 1 },
  ],
};

const GENERIC_SEED: DemoSeed[] = [
  { name: 'Ítem de ejemplo 1', category: 'General', price: 10, quantity: 5 },
  { name: 'Ítem de ejemplo 2', category: 'General', price: 20, quantity: 3 },
  { name: 'Ítem de ejemplo 3', category: 'General', price: 15, quantity: 0 },
  { name: 'Ítem de ejemplo 4', category: 'General', price: 8, quantity: 10 },
  { name: 'Ítem de ejemplo 5', category: 'General', price: 30, quantity: 1 },
];

export interface PracticeItemDto {
  type: string;
  name: string;
  description?: string;
  category?: string;
  price?: number;
  quantity?: number;
  active?: boolean;
}

@Injectable()
export class PracticeApiService {
  constructor(
    @InjectRepository(PracticeItem)
    private itemRepo: Repository<PracticeItem>,
  ) {}

  private demoSeedFor(type: string): DemoSeed[] {
    return DEMO_SEEDS[type] ?? GENERIC_SEED;
  }

  private async ensureSeeded(type: string) {
    const count = await this.itemRepo.count({ where: { type } });
    if (count > 0) return;
    const rows = this.demoSeedFor(type).map((seed) =>
      this.itemRepo.create({ type, ...seed }),
    );
    await this.itemRepo.save(rows);
  }

  async list(type: string) {
    if (!type) return [];
    await this.ensureSeeded(type);
    return this.itemRepo.find({ where: { type }, order: { created_at: 'ASC' } });
  }

  async getOne(id: string) {
    const item = await this.itemRepo.findOne({ where: { id } });
    if (!item) throw new NotFoundException('Ítem no encontrado');
    return item;
  }

  async create(dto: PracticeItemDto) {
    const item = this.itemRepo.create({
      type: dto.type,
      name: dto.name,
      description: dto.description,
      category: dto.category,
      price: dto.price ?? 0,
      quantity: dto.quantity ?? 1,
      active: dto.active ?? true,
    });
    return this.itemRepo.save(item);
  }

  async update(id: string, dto: Partial<PracticeItemDto>) {
    await this.getOne(id);
    await this.itemRepo.update(id, {
      ...(dto.name !== undefined ? { name: dto.name } : {}),
      ...(dto.description !== undefined ? { description: dto.description } : {}),
      ...(dto.category !== undefined ? { category: dto.category } : {}),
      ...(dto.price !== undefined ? { price: dto.price } : {}),
      ...(dto.quantity !== undefined ? { quantity: dto.quantity } : {}),
      ...(dto.active !== undefined ? { active: dto.active } : {}),
    });
    return this.getOne(id);
  }

  async remove(id: string) {
    await this.getOne(id);
    await this.itemRepo.delete(id);
    return { success: true };
  }

  async reset(type: string) {
    await this.itemRepo.delete({ type });
    await this.ensureSeeded(type);
    return this.list(type);
  }
}
