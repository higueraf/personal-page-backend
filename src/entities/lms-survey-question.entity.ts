import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { LmsActivity } from './lms-activity.entity';
import { LmsSurveyOption } from './lms-survey-option.entity';

export enum LmsSurveyQuestionType {
  SINGLE_CHOICE = 'SINGLE_CHOICE',
  MULTIPLE_CHOICE = 'MULTIPLE_CHOICE',
  SCALE = 'SCALE',
  TEXT = 'TEXT',
}

/** Pregunta del banco de una encuesta (activity.type 'survey'). Sin respuesta correcta: se agregan resultados, no se califica. */
@Entity('lms_survey_questions')
export class LmsSurveyQuestion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => LmsActivity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'activity_id' })
  activity: LmsActivity;

  @Column()
  activity_id: string;

  @Column({ type: 'text' })
  text: string;

  @Column({ type: 'enum', enum: LmsSurveyQuestionType, default: LmsSurveyQuestionType.SINGLE_CHOICE })
  type: LmsSurveyQuestionType;

  @Column({ default: 1 })
  order: number;

  /** Solo para type = SCALE (ej. 1..5). */
  @Column({ type: 'int', nullable: true })
  scale_min: number | null;

  @Column({ type: 'int', nullable: true })
  scale_max: number | null;

  @OneToMany(() => LmsSurveyOption, (option) => option.question)
  options: LmsSurveyOption[];
}
