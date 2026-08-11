import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { PlaygroundProject } from './playground-project.entity';

/**
 * Snapshot completo de los archivos de un examen en un momento dado. Se crea uno nuevo
 * cada vez que se llama a `saveAllFiles` (auto-save cada 5 min o guardado manual) para
 * proyectos de examen, permitiendo al admin ver cómo fue avanzando el alumno sin que esto
 * afecte en nada al estado/ejecución real del proyecto (es una tabla aparte, solo lectura).
 */
@Entity('playground_snapshots')
export class PlaygroundSnapshot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => PlaygroundProject, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project: PlaygroundProject;

  @Column()
  project_id: string;

  @Column({ type: 'jsonb' })
  files: Array<{ name: string; path: string; content: string; is_folder: boolean }>;

  @CreateDateColumn()
  created_at: Date;
}
