import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TodoItem } from '../../entities/todo-item.entity';

const DEMO_TODOS = [
  { nombre: 'Comprar pan', hecho: false, duracion: 15, presupuesto: 3.5 },
  { nombre: 'Estudiar Flutter', hecho: false, duracion: 90, presupuesto: 0 },
  { nombre: 'Hacer ejercicio', hecho: true, duracion: 45, presupuesto: 0 },
  { nombre: 'Leer un libro', hecho: false, duracion: 30, presupuesto: 12.0 },
  { nombre: 'Llamar al médico', hecho: true, duracion: 10, presupuesto: 25.0 },
];

@Injectable()
export class TodoApiService {
  constructor(
    @InjectRepository(TodoItem)
    private todoRepo: Repository<TodoItem>,
  ) {}

  private async ensureSeeded() {
    const count = await this.todoRepo.count();
    if (count > 0) return;
    const rows = DEMO_TODOS.map((data) => this.todoRepo.create(data));
    await this.todoRepo.save(rows);
  }

  async list() {
    await this.ensureSeeded();
    return this.todoRepo.find({ order: { created_at: 'ASC' } });
  }

  async getOne(id: string) {
    const todo = await this.todoRepo.findOne({ where: { id } });
    if (!todo) throw new NotFoundException('Tarea no encontrada');
    return todo;
  }

  async create(body: { nombre?: string; hecho?: boolean; duracion?: number; presupuesto?: number }) {
    const todo = this.todoRepo.create({
      nombre: body?.nombre ?? '',
      hecho: body?.hecho ?? false,
      duracion: body?.duracion ?? 0,
      presupuesto: body?.presupuesto ?? 0,
    });
    return this.todoRepo.save(todo);
  }

  async update(id: string, body: { nombre?: string; hecho?: boolean; duracion?: number; presupuesto?: number }) {
    const todo = await this.todoRepo.findOne({ where: { id } });
    if (!todo) throw new NotFoundException('Tarea no encontrada');
    if (typeof body?.nombre === 'string') todo.nombre = body.nombre;
    if (typeof body?.hecho === 'boolean') todo.hecho = body.hecho;
    if (typeof body?.duracion === 'number') todo.duracion = body.duracion;
    if (typeof body?.presupuesto === 'number') todo.presupuesto = body.presupuesto;
    return this.todoRepo.save(todo);
  }

  async remove(id: string) {
    const todo = await this.todoRepo.findOne({ where: { id } });
    if (!todo) throw new NotFoundException('Tarea no encontrada');
    await this.todoRepo.delete(id);
    return { success: true };
  }

  async reset() {
    await this.todoRepo.clear();
    await this.ensureSeeded();
    return this.list();
  }
}
