import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Lesson } from './lesson.entity';
import { ContentBlock } from './content-block.entity';

@Entity('lesson_pages')
export class LessonPage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Lesson, (lesson) => lesson.pages, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'lesson_id' })
  lesson: Lesson;

  @Column({ nullable: true })
  title: string | null;

  @Column({ default: 1 })
  order: number;

  @Column({ default: 5 })
  estimated_minutes: number;

  @Column({ default: 'DRAFT' })
  status: string;

  @OneToMany(() => ContentBlock, (block) => block.page)
  blocks: ContentBlock[];
}
