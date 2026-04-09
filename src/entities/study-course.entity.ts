import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Institution } from './institution.entity';

@Entity('study_courses')
export class StudyCourse {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @ManyToOne(() => Institution, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'institution_id' })
  institution?: Institution;

  @Column({ nullable: true })
  institution_id?: string;

  @CreateDateColumn()
  created_at: Date;
}
