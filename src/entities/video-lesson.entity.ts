import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { VideoSection } from './video-section.entity';

@Entity('video_lessons')
export class VideoLesson {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => VideoSection, (section) => section.lessons, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'section_id' })
  section: VideoSection;

  @Column()
  title: string;

  @Column()
  slug: string;

  @Column({ default: 1 })
  order: number;

  @Column({ default: 'DRAFT' })
  status: string;

  @Column({ default: 'none' })
  video_type: string;

  @Column({ nullable: true })
  video_url: string | null;

  @Column({ nullable: true })
  video_file: string | null;

  @Column({ default: 0 })
  duration_seconds: number;

  @Column({ type: 'text', default: '' })
  markdown: string;

  @Column({ default: false })
  is_free_preview: boolean;
}
