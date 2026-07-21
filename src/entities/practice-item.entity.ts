import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Recurso genérico y aislado de "API de práctica" — usado únicamente para que
 * los alumnos consuman un CRUD real (ej. desde un examen de Flutter) sin
 * afectar ni relacionarse con las tablas/entidades del sitio.
 *
 * `type` es un namespace liviano (ej. "ropa", "libros", "farmacia", "tareas")
 * que separa lógicamente los datos de cada variante de examen sin necesidad
 * de aislar por alumno — la corrección se hace leyendo el código del alumno,
 * no el estado de esta tabla.
 */
@Entity('practice_items')
export class PracticeItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  type: string;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ nullable: true })
  category: string;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  price: number;

  @Column({ default: 1 })
  quantity: number;

  @Column({ default: true })
  active: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
