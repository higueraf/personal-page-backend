import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';

export interface PlaygroundTemplateFile {
  name: string;
  path: string;
  content: string;
  is_folder: boolean;
}

@Entity('playground_templates')
export class PlaygroundTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column()
  language: string;

  @Column({ type: 'jsonb', default: [] })
  files: PlaygroundTemplateFile[];

  /** Cuando es 'pdf', el enunciado de la plantilla se entrega como el PDF subido
   *  (statement_pdf_url) en vez del texto de `description`. */
  @Column({ default: 'text' })
  statement_type: 'text' | 'pdf';

  @Column({ type: 'varchar', nullable: true })
  statement_pdf_url: string | null;

  @Column({ type: 'varchar', nullable: true })
  statement_pdf_original_name: string | null;

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'created_by' })
  createdBy: User;

  @Column()
  created_by: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
