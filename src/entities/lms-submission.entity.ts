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

export enum LmsSubmissionStatus {
  PENDING = 'PENDING',
  SUBMITTED = 'SUBMITTED',
  LATE = 'LATE',
  GRADED = 'GRADED',
}

/** Entrega de una tarea (o de un examen formal con revisión manual). */
@Entity('lms_submissions')
@Unique(['activity_id', 'student_id'])
export class LmsSubmission {
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

  @Column({ type: 'text', nullable: true })
  content_text: string | null;

  @Column({ nullable: true })
  file_url?: string;

  @Column({ type: 'enum', enum: LmsSubmissionStatus, default: LmsSubmissionStatus.PENDING })
  status: LmsSubmissionStatus;

  @Column({ type: 'timestamptz', nullable: true })
  submitted_at: Date | null;

  @Column({ type: 'float', nullable: true })
  grade: number | null;

  @Column({ type: 'text', nullable: true })
  feedback: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'graded_by_id' })
  graded_by?: User;

  @Column({ nullable: true })
  graded_by_id?: string;

  @Column({ type: 'timestamptz', nullable: true })
  graded_at?: Date | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
