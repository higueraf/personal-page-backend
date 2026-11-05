import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './user.entity';
import { StudyCourse } from './study-course.entity';
import { LmsCourseUnit } from './lms-course-unit.entity';

export enum LmsCourseStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  ARCHIVED = 'ARCHIVED',
}

@Entity('lms_courses')
export class LmsCourse {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column({ unique: true })
  slug: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'enum', enum: LmsCourseStatus, default: LmsCourseStatus.DRAFT })
  status: LmsCourseStatus;

  @Column({ nullable: true })
  cover_image?: string;

  /** Si es false, el curso no aparece en el catálogo de auto-matrícula y un alumno no puede
   *  inscribirse por su cuenta; solo el profesor/admin puede matricularlo manualmente (roster). */
  @Column({ default: false })
  is_public: boolean;

  /** Profesor propietario del curso */
  @ManyToOne(() => User, { nullable: false, eager: false })
  @JoinColumn({ name: 'teacher_id' })
  teacher: User;

  @Column()
  teacher_id: string;

  /** Profesores adicionales con el mismo acceso de gestión que el dueño (ver `assertTeacherOwnsCourse`) */
  @ManyToMany(() => User, { nullable: true })
  @JoinTable({
    name: 'lms_course_co_teachers',
    joinColumn: { name: 'lms_course_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'user_id', referencedColumnName: 'id' },
  })
  co_teachers?: User[];

  /** Programas académicos que pueden inscribirse (misma convención que Course.study_courses) */
  @ManyToMany(() => StudyCourse, { nullable: true })
  @JoinTable({
    name: 'lms_course_study_courses',
    joinColumn: { name: 'lms_course_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'study_course_id', referencedColumnName: 'id' },
  })
  study_courses?: StudyCourse[];

  @OneToMany(() => LmsCourseUnit, (unit) => unit.course)
  units: LmsCourseUnit[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
