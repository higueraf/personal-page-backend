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
 * construir (ese usa `PracticeItem`, con campos propios por variante).
 * Maneja 4 campos con distintos tipos (string/bool/int/double), a propósito,
 * para que sirva de plantilla de arquitectura por capas (modelo/servicio/
 * pantallas) con la misma variedad de tipos que las variantes reales.
 */
@Entity('todo_items')
export class TodoItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  nombre: string;

  @Column({ default: false })
  hecho: boolean;

  @Column({ default: 0 })
  duracion: number;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  presupuesto: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
