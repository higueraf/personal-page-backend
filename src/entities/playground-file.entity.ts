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

  /** 'pdf' marca un archivo como una referencia a un PDF subido (ver `external_url`)
   *  que debe abrirse en un visor embebido en vez de cargarse en el editor Monaco. */
  @Column({ default: 'code' })
  file_type: 'code' | 'pdf';

  @Column({ type: 'varchar', nullable: true })
  external_url: string | null;

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
