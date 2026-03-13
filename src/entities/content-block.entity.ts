import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { LessonPage } from './lesson-page.entity';

@Entity('content_blocks')
export class ContentBlock {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => LessonPage, (page) => page.blocks, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'page_id' })
  page: LessonPage;

  @Column()
  type: string;

  @Column({ default: 1 })
  order: number;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  data: Record<string, any>;
}
