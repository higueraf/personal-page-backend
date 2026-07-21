import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TodoItem } from '../../entities/todo-item.entity';

const DEMO_TODOS = ['Comprar pan', 'Estudiar Flutter', 'Hacer ejercicio', 'Leer un libro', 'Llamar al médico'];

@Injectable()
export class TodoApiService {
  constructor(
    @InjectRepository(TodoItem)
    private todoRepo: Repository<TodoItem>,
  ) {}

  private async ensureSeeded() {
    const count = await this.todoRepo.count();
    if (count > 0) return;
    const rows = DEMO_TODOS.map((nombre) => this.todoRepo.create({ nombre }));
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

  async create(body: { nombre?: string }) {
    const todo = this.todoRepo.create({ nombre: body?.nombre ?? '' });
    return this.todoRepo.save(todo);
  }

  async update(id: string, body: { nombre?: string }) {
    const todo = await this.todoRepo.findOne({ where: { id } });
    if (!todo) throw new NotFoundException('Tarea no encontrada');
    if (typeof body?.nombre === 'string') todo.nombre = body.nombre;
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
