import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Course } from './course.entity';
import { Lesson } from './lesson.entity';

@Entity('course_sections')
export class CourseSection {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Course, (course) => course.sections, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'course_id' })
  course: Course;

  @Column()
  title: string;

  @Column({ default: 1 })
  order: number;

  @Column({ default: 'DRAFT', nullable: true })
  status: string;

  @OneToMany(() => Lesson, (lesson) => lesson.section)
  lessons: Lesson[];
}
