import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { VideoCourse } from './video-course.entity';
import { VideoLesson } from './video-lesson.entity';

@Entity('video_sections')
export class VideoSection {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => VideoCourse, (course) => course.sections, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'course_id' })
  course: VideoCourse;

  @Column()
  title: string;

  @Column({ default: 1 })
  order: number;

  @OneToMany(() => VideoLesson, (lesson) => lesson.section)
  lessons: VideoLesson[];
}
