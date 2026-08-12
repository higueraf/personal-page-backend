import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';
import { PlaygroundFile } from './playground-file.entity';
import { ExamVersion } from './exam-version.entity';

export enum ProjectStatus {
  PENDING = 'pending',
  SUBMITTED = 'submitted',
  GRADED = 'graded',
}

@Entity('playground_projects')
export class PlaygroundProject {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ default: 'web' })
  type: string;

  /** Language identifier: python | javascript | typescript | kotlin | dart | html | react | vue | angular */
  @Column({ nullable: true, default: 'python' })
  language: string;

  @Column({ nullable: true })
  materia: string;

  @Column({ default: false })
  is_exam: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  start_time: Date;

  @Column({ type: 'timestamptz', nullable: true })
  end_time: Date;

  @Column({ default: true })
  allow_copy_paste: boolean;

  @Column({ default: false })
  require_seb: boolean;

  /** Minutes offset from UTC used to interpret/display this exam's start/end times
   *  (e.g. -300 for UTC-5 / Ecuador, which is the platform-wide default). Stored per
   *  exam/assignment batch so admins can schedule exams for students in other timezones. */
  @Column({ type: 'int', default: -300 })
  timezone_offset_minutes: number;

  @Column({
    type: 'enum',
    enum: ProjectStatus,
    default: ProjectStatus.PENDING,
  })
  status: ProjectStatus;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  grade: number;

  @Column({ type: 'text', nullable: true })
  feedback: string;

  @Column({ type: 'jsonb', default: [] })
  cheating_logs: Array<{ timestamp: string; action: string; details?: string }>;

  /** Se activa automáticamente cuando se acumulan demasiados incidentes reales de seguridad
   *  (ver `logCheat` en playground.service.ts). Mientras esté en `true`, el examen queda en
   *  solo lectura (no se puede guardar/ejecutar) hasta que un admin/profesor lo reactive. */
  @Column({ default: false })
  security_locked: boolean;

  /** Groups all PlaygroundProjects created from the same assignment batch */
  @Column({ nullable: true })
  exam_group_id: string;

  /** Which themed variant (ExamVersion) was assigned to this student, if any */
  @ManyToOne(() => ExamVersion, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'exam_version_id' })
  examVersion: ExamVersion;

  @Column({ nullable: true })
  exam_version_id: string;

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column()
  user_id: string;

  @OneToMany('PlaygroundFile', (file: any) => file.project, { cascade: true })
  files: PlaygroundFile[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
