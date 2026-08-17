import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LmsActivity } from '../../entities/lms-activity.entity';
import { LmsForumThread } from '../../entities/lms-forum-thread.entity';
import { LmsForumPost } from '../../entities/lms-forum-post.entity';
import { User } from '../../entities/user.entity';
import { CreateForumPostDto, CreateForumThreadDto } from './dto/lms.dto';
import { LmsCoursesService } from './lms-courses.service';
import { LmsActivitiesService } from './lms-activities.service';

@Injectable()
export class LmsForumService {
  constructor(
    @InjectRepository(LmsActivity) private readonly activitiesRepo: Repository<LmsActivity>,
    @InjectRepository(LmsForumThread) private readonly threadsRepo: Repository<LmsForumThread>,
    @InjectRepository(LmsForumPost) private readonly postsRepo: Repository<LmsForumPost>,
    private readonly coursesService: LmsCoursesService,
    private readonly activitiesService: LmsActivitiesService,
  ) {}

  private async activityOrFail(id: string) {
    const activity = await this.activitiesRepo.findOne({ where: { id, type: 'forum' }, relations: ['unit'] });
    if (!activity) throw new NotFoundException('Actividad de foro no encontrada');
    return activity;
  }

  private async assertAccess(activity: LmsActivity, user: User) {
    const roleName = user.role?.name?.toLowerCase();
    if (roleName === 'admin') return;
    if (roleName === 'teacher') {
      await this.coursesService.getForManage(activity.unit.course_id, user);
      return;
    }
    if (activity.status !== 'PUBLISHED') throw new NotFoundException('Actividad no encontrada');
    await this.coursesService.assertEnrolled(activity.unit.course_id, user);
  }

  async listThreads(activityId: string, user: User) {
    const activity = await this.activityOrFail(activityId);
    await this.assertAccess(activity, user);
    return this.threadsRepo.find({
      where: { activity_id: activityId },
      relations: ['author'],
      order: { is_pinned: 'DESC', created_at: 'DESC' },
    });
  }

  async getThread(threadId: string, user: User) {
    const thread = await this.threadsRepo.findOne({ where: { id: threadId }, relations: ['author'] });
    if (!thread) throw new NotFoundException('Hilo no encontrado');
    const activity = await this.activityOrFail(thread.activity_id);
    await this.assertAccess(activity, user);
    const posts = await this.postsRepo.find({
      where: { thread_id: threadId },
      relations: ['author'],
      order: { created_at: 'ASC' },
    });
    return { ...thread, posts };
  }

  async createThread(dto: CreateForumThreadDto, user: User) {
    const activity = await this.activityOrFail(dto.activity);
    await this.assertAccess(activity, user);
    const thread = await this.threadsRepo.save(
      this.threadsRepo.create({ activity_id: dto.activity, author_id: user.id, title: dto.title, body: dto.body }),
    );
    await this.activitiesService.markCompleted(activity.id, activity.unit.course_id, user.id);
    return thread;
  }

  async createPost(dto: CreateForumPostDto, user: User) {
    const thread = await this.threadsRepo.findOne({ where: { id: dto.thread } });
    if (!thread) throw new NotFoundException('Hilo no encontrado');
    if (thread.is_locked) throw new ForbiddenException('El hilo está cerrado');
    const activity = await this.activityOrFail(thread.activity_id);
    await this.assertAccess(activity, user);
    const post = await this.postsRepo.save(
      this.postsRepo.create({
        thread_id: dto.thread,
        author_id: user.id,
        body: dto.body,
        parent_post_id: dto.parent_post,
        mentioned_user_ids: dto.mentioned_user_ids,
      }),
    );
    await this.activitiesService.markCompleted(activity.id, activity.unit.course_id, user.id);
    return post;
  }

  async setThreadModeration(threadId: string, patch: { is_pinned?: boolean; is_locked?: boolean }, user: User) {
    const thread = await this.threadsRepo.findOne({ where: { id: threadId } });
    if (!thread) throw new NotFoundException('Hilo no encontrado');
    const activity = await this.activityOrFail(thread.activity_id);
    await this.coursesService.getForManage(activity.unit.course_id, user);
    if (patch.is_pinned !== undefined) thread.is_pinned = patch.is_pinned;
    if (patch.is_locked !== undefined) thread.is_locked = patch.is_locked;
    return this.threadsRepo.save(thread);
  }
}
