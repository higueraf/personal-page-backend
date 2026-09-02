import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { LmsCourseUnit } from './lms-course-unit.entity';

/**
 * Actividad/recurso publicado por el profesor dentro de una unidad. `type` es
 * un catálogo abierto (ver src/common/lms-activity-types.ts): presentación,
 * foro, tarea, quiz o examen hoy; un tipo nuevo no requiere cambiar esta
 * entidad, solo agregar su propia tabla de detalle (como LmsSubmission o
 * LmsQuizQuestion) y su propio manejo en el servicio/controlador.
 */
@Entity('lms_activities')
export class LmsActivity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => LmsCourseUnit, (unit) => unit.activities, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'unit_id' })
  unit: LmsCourseUnit;

  @Column()
  unit_id: string;

  @Column()
  type: string;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  instructions: string | null;

  @Column({ default: 1 })
  order: number;

  @Column({ default: 'DRAFT' })
  status: string;

  /** Fecha de activación: antes de esta fecha el alumno no puede abrir la actividad. */
  @Column({ type: 'timestamptz', nullable: true })
  starts_at: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  due_at: Date | null;

  @Column({ type: 'float', nullable: true })
  max_score: number | null;

  /**
   * Datos ligeros específicos del tipo, p.ej. para presentation:
   * { file_url, embed_url }; para exam: { mode: 'quiz'|'manual'|'external',
   * external_url, external_params }. Las relaciones pesadas (hilos de foro,
   * entregas, banco de preguntas) viven en sus propias tablas por activity_id.
   */
  @Column({ type: 'jsonb', default: () => "'{}'" })
  config: Record<string, any>;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
