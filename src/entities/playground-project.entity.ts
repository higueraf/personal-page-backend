import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';
import { PlaygroundFile } from './playground-file.entity';

export enum ProjectStatus {
  PENDING = 'pending',
  SUBMITTED = 'submitted',
  GRADED = 'graded',
}

@Entity('playground_projects')
export class PlaygroundProject {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ default: 'web' })
  type: string;

  /** Language identifier: python | javascript | typescript | kotlin | dart | html | react | vue | angular */
  @Column({ nullable: true, default: 'python' })
  language: string;

  @Column({ nullable: true })
  materia: string;

  @Column({ default: false })
  is_exam: boolean;

  @Column({ type: 'timestamp', nullable: true })
  start_time: Date;

  @Column({ type: 'timestamp', nullable: true })
  end_time: Date;

  @Column({ default: true })
  allow_copy_paste: boolean;

  @Column({
    type: 'enum',
    enum: ProjectStatus,
    default: ProjectStatus.PENDING,
  })
  status: ProjectStatus;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  grade: number;

  @Column({ type: 'text', nullable: true })
  feedback: string;

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column()
  user_id: string;

  @OneToMany('PlaygroundFile', (file: any) => file.project, { cascade: true })
  files: PlaygroundFile[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
