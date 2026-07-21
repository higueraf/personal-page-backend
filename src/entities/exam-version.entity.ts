import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
} from 'typeorm';
import { ExamTemplate } from './exam-template.entity';

export interface ExamQuestion {
  order: number;
  title: string;
  points: number;
  statement: string;
}

@Entity('exam_versions')
export class ExamVersion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Business-domain theme for this variant, e.g. "Restaurante", "Cine" */
  @Column()
  theme_name: string;

  @Column({ default: 0 })
  order_index: number;

  @Column({ type: 'jsonb', default: [] })
  questions: ExamQuestion[];

  @ManyToOne(() => ExamTemplate, (template) => template.versions, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'exam_template_id' })
  examTemplate: ExamTemplate;

  @Column()
  exam_template_id: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
