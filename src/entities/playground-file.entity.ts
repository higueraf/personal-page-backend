import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PlaygroundProject } from './playground-project.entity';

@Entity('playground_files')
export class PlaygroundFile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ default: '' })
  path: string;

  @Column({ type: 'text', default: '' })
  content: string;

  @Column({ default: false })
  is_folder: boolean;

  @ManyToOne('PlaygroundProject', (project: any) => project.files, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project: PlaygroundProject;

  @Column()
  project_id: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
