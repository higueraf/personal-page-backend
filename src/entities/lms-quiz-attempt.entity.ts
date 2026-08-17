import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { LmsActivity } from './lms-activity.entity';
import { User } from './user.entity';
import { LmsQuizAnswer } from './lms-quiz-answer.entity';

@Entity('lms_quiz_attempts')
export class LmsQuizAttempt {
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

  @Column({ type: 'float', nullable: true })
  score: number | null;

  @Column({ type: 'timestamptz', nullable: true })
  submitted_at: Date | null;

  @OneToMany(() => LmsQuizAnswer, (answer) => answer.attempt)
  answers: LmsQuizAnswer[];

  @CreateDateColumn()
  created_at: Date;
}
