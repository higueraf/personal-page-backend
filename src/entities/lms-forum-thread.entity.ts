import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { LmsActivity } from './lms-activity.entity';
import { User } from './user.entity';
import { LmsForumPost } from './lms-forum-post.entity';

@Entity('lms_forum_threads')
export class LmsForumThread {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => LmsActivity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'activity_id' })
  activity: LmsActivity;

  @Column()
  activity_id: string;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'author_id' })
  author: User;

  @Column()
  author_id: string;

  @Column()
  title: string;

  @Column({ type: 'text' })
  body: string;

  @Column({ default: false })
  is_pinned: boolean;

  @Column({ default: false })
  is_locked: boolean;

  @OneToMany(() => LmsForumPost, (post) => post.thread)
  posts: LmsForumPost[];

  @CreateDateColumn()
  created_at: Date;
}
