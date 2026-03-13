import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export enum ProjectStatus {
  DRAFT     = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  ARCHIVED  = 'ARCHIVED',
}

@Entity('projects')
export class Project {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column({ unique: true })
  slug: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'text', nullable: true })
  long_description: string | null;

  @Column({ type: 'simple-array', nullable: true })
  tech_stack: string[];

  @Column({ nullable: true })
  url: string | null;

  @Column({ nullable: true })
  repo_url: string | null;

  @Column({ nullable: true })
  thumbnail: string | null;

  @Column({ type: 'int', default: 0 })
  order: number;

  @Column({ type: 'enum', enum: ProjectStatus, default: ProjectStatus.DRAFT })
  status: ProjectStatus;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
