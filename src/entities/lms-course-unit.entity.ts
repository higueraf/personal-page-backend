import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { LmsCourse } from './lms-course.entity';
import { LmsActivity } from './lms-activity.entity';

/** Módulo/unidad dentro de un curso académico (equivalente a una sección de Moodle). */
@Entity('lms_course_units')
export class LmsCourseUnit {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => LmsCourse, (course) => course.units, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'course_id' })
  course: LmsCourse;

  @Column()
  course_id: string;

  @Column()
  title: string;

  @Column({ default: 1 })
  order: number;

  @Column({ default: 'DRAFT' })
  status: string;

  @OneToMany(() => LmsActivity, (activity) => activity.unit)
  activities: LmsActivity[];
}
