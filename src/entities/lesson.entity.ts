import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { CourseSection } from './course-section.entity';
import { LessonPage } from './lesson-page.entity';

@Entity('lessons')
export class Lesson {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => CourseSection, (section) => section.lessons, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'section_id' })
  section: CourseSection;

  @Column()
  title: string;

  @Column()
  slug: string;

  @Column({ type: 'text', nullable: true })
  summary: string | null;

  @Column({ default: 1 })
  order: number;

  @Column({ default: 'DRAFT' })
  status: string;

  @OneToMany(() => LessonPage, (page) => page.lesson)
  pages: LessonPage[];
}
