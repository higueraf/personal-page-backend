import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { LmsActivity } from './lms-activity.entity';
import { User } from './user.entity';

export enum LmsActivityProgressStatus {
  NOT_STARTED = 'NOT_STARTED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
}

/** Progreso e historial de calificación de un alumno por actividad; agregado a nivel de curso en LmsEnrollment.progress_percent. */
@Entity('lms_activity_progress')
@Unique(['activity_id', 'student_id'])
export class LmsActivityProgress {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => LmsActivity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'activity_id' })
  activity: LmsActivity;

  @Column()
  activity_id: string;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'student_id' })
  student: User;

  @Column()
  student_id: string;

  @Column({ type: 'enum', enum: LmsActivityProgressStatus, default: LmsActivityProgressStatus.NOT_STARTED })
  status: LmsActivityProgressStatus;

  @Column({ type: 'float', nullable: true })
  score: number | null;

  @Column({ type: 'timestamptz', nullable: true })
  completed_at: Date | null;

  @UpdateDateColumn()
  last_viewed_at: Date;

  @CreateDateColumn()
  created_at: Date;
}
