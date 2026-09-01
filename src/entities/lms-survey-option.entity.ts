import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { LmsSurveyQuestion } from './lms-survey-question.entity';

@Entity('lms_survey_options')
export class LmsSurveyOption {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => LmsSurveyQuestion, (question) => question.options, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'question_id' })
  question: LmsSurveyQuestion;

  @Column()
  question_id: string;

  @Column({ type: 'text' })
  text: string;

  @Column({ default: 1 })
  order: number;
}
