import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { LmsForumThread } from './lms-forum-thread.entity';
import { User } from './user.entity';

@Entity('lms_forum_posts')
export class LmsForumPost {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => LmsForumThread, (thread) => thread.posts, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'thread_id' })
  thread: LmsForumThread;

  @Column()
  thread_id: string;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'author_id' })
  author: User;

  @Column()
  author_id: string;

  @Column({ type: 'text' })
  body: string;

  /** IDs de usuarios mencionados (@nombre) para futuras notificaciones */
  @Column({ type: 'simple-array', nullable: true })
  mentioned_user_ids?: string[];

  @ManyToOne(() => LmsForumPost, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'parent_post_id' })
  parent_post?: LmsForumPost;

  @Column({ nullable: true })
  parent_post_id?: string;

  @CreateDateColumn()
  created_at: Date;
}
