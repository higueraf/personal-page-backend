import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { LmsActivity } from './lms-activity.entity';
import { LmsQuizOption } from './lms-quiz-option.entity';

export enum LmsQuestionType {
  MULTIPLE_CHOICE = 'MULTIPLE_CHOICE',
  OPEN = 'OPEN',
}

/** Pregunta del banco de un quiz o examen (activity.type 'quiz' o 'exam' con config.mode='quiz'). */
@Entity('lms_quiz_questions')
export class LmsQuizQuestion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => LmsActivity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'activity_id' })
  activity: LmsActivity;

  @Column()
  activity_id: string;

  @Column({ type: 'text' })
  text: string;

  @Column({ type: 'enum', enum: LmsQuestionType, default: LmsQuestionType.MULTIPLE_CHOICE })
  type: LmsQuestionType;

  @Column({ default: 1 })
  order: number;

  /** Retroalimentación inmediata mostrada al alumno tras responder */
  @Column({ type: 'text', nullable: true })
  feedback: string | null;

  @OneToMany(() => LmsQuizOption, (option) => option.question)
  options: LmsQuizOption[];
}
