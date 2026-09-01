import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { LmsSurveyResponse } from './lms-survey-response.entity';
import { LmsSurveyQuestion } from './lms-survey-question.entity';

@Entity('lms_survey_answers')
export class LmsSurveyAnswer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => LmsSurveyResponse, (response) => response.answers, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'response_id' })
  response: LmsSurveyResponse;

  @Column()
  response_id: string;

  @ManyToOne(() => LmsSurveyQuestion, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'question_id' })
  question: LmsSurveyQuestion;

  @Column()
  question_id: string;

  /** SINGLE_CHOICE (un id) o MULTIPLE_CHOICE (varios). */
  @Column({ type: 'jsonb', nullable: true })
  selected_option_ids: string[] | null;

  @Column({ type: 'int', nullable: true })
  scale_value: number | null;

  @Column({ type: 'text', nullable: true })
  text_answer: string | null;
}
