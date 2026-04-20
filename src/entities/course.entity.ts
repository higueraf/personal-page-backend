import { Column, CreateDateColumn, Entity, JoinTable, ManyToMany, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { CourseSection } from './course-section.entity';
import { StudyCourse } from './study-course.entity';

@Entity('courses')
export class Course {
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

  /** Si true, el contenido es accesible sin login ni rol */
  @Column({ default: false })
  is_public: boolean;

  /** Programas académicos a los que pertenece este curso/tutorial */
  @ManyToMany(() => StudyCourse, { nullable: true, eager: false })
  @JoinTable({
    name: 'course_study_courses',
    joinColumn: { name: 'course_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'study_course_id', referencedColumnName: 'id' },
  })
  study_courses?: StudyCourse[];

  @OneToMany(() => CourseSection, (section) => section.course)
  sections: CourseSection[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
