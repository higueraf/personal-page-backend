import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { LmsQuizQuestion } from './lms-quiz-question.entity';

@Entity('lms_quiz_options')
export class LmsQuizOption {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => LmsQuizQuestion, (question) => question.options, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'question_id' })
  question: LmsQuizQuestion;

  @Column()
  question_id: string;

  @Column({ type: 'text' })
  text: string;

  @Column({ default: false })
  is_correct: boolean;

  @Column({ default: 1 })
  order: number;
}
