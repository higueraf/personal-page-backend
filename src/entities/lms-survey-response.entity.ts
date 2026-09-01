import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { LmsActivity } from './lms-activity.entity';
import { User } from './user.entity';
import { LmsSurveyAnswer } from './lms-survey-answer.entity';

/** Una fila por alumno que respondió una encuesta; existe aunque sea anónima, solo para evitar respuestas duplicadas. */
@Entity('lms_survey_responses')
@Unique(['activity_id', 'student_id'])
export class LmsSurveyResponse {
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

  @Column({ type: 'timestamptz', nullable: true })
  submitted_at: Date | null;

  @OneToMany(() => LmsSurveyAnswer, (answer) => answer.response)
  answers: LmsSurveyAnswer[];

  @CreateDateColumn()
  created_at: Date;
}
