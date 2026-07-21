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
 * `type` es la variante de examen (ej. "ropa", "libros", "farmacia", "tareas")
 * y también el segmento de URL del endpoint (`/practice-api/:type/items`).
 * `data` guarda los campos propios de cada variante (mínimo 7, distintos
 * nombres por variante — ver `practice-variants.config.ts`) en formato libre,
 * para no necesitar una tabla ni columnas distintas por variante.
 */
@Entity('practice_items')
export class PracticeItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  type: string;

  @Column('jsonb', { default: {} })
  data: Record<string, any>;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
