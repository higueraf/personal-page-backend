import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { VideoSection } from './video-section.entity';

@Entity('video_courses')
export class VideoCourse {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column({ unique: true })
  slug: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ nullable: true })
  level: string | null;

  @Column({ default: 'DRAFT' })
  status: string;

  @Column({ nullable: true })
  thumbnail: string | null;

  @OneToMany(() => VideoSection, (section) => section.course)
  sections: VideoSection[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
