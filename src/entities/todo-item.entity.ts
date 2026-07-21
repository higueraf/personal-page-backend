import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Entidad de ejemplo pública ("ToDo") usada como referencia funcional en el
 * examen de Flutter — no forma parte del CRUD real que el alumno debe
 * construir (ese usa `PracticeItem`, con campos propios por variante). Solo
 * maneja 2 campos (id + nombre) a propósito, para que sirva de plantilla
 * simple de arquitectura por capas (modelo/servicio/pantallas) que el alumno
 * puede estudiar y replicar.
 */
@Entity('todo_items')
export class TodoItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  nombre: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
