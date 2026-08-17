import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { LmsQuizAttempt } from './lms-quiz-attempt.entity';
import { LmsQuizQuestion } from './lms-quiz-question.entity';
import { LmsQuizOption } from './lms-quiz-option.entity';

@Entity('lms_quiz_answers')
export class LmsQuizAnswer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => LmsQuizAttempt, (attempt) => attempt.answers, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'attempt_id' })
  attempt: LmsQuizAttempt;

  @Column()
  attempt_id: string;

  @ManyToOne(() => LmsQuizQuestion, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'question_id' })
  question: LmsQuizQuestion;

  @Column()
  question_id: string;

  @ManyToOne(() => LmsQuizOption, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'selected_option_id' })
  selected_option?: LmsQuizOption;

  @Column({ nullable: true })
  selected_option_id?: string;

  @Column({ type: 'text', nullable: true })
  text_answer?: string;

  @Column({ nullable: true })
  is_correct?: boolean;
}
