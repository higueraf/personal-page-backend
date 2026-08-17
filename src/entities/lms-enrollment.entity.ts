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
import { LmsCourse } from './lms-course.entity';
import { User } from './user.entity';

export enum LmsEnrollmentStatus {
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  DROPPED = 'DROPPED',
}

@Entity('lms_enrollments')
@Unique(['course_id', 'student_id'])
export class LmsEnrollment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => LmsCourse, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'course_id' })
  course: LmsCourse;

  @Column()
  course_id: string;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'student_id' })
  student: User;

  @Column()
  student_id: string;

  @Column({ type: 'enum', enum: LmsEnrollmentStatus, default: LmsEnrollmentStatus.ACTIVE })
  status: LmsEnrollmentStatus;

  /** Cache de progreso para listados rápidos; se recalcula desde LmsActivityProgress */
  @Column({ default: 0 })
  progress_percent: number;

  @Column({ type: 'timestamptz', nullable: true })
  last_activity_at: Date | null;

  @CreateDateColumn()
  enrolled_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
