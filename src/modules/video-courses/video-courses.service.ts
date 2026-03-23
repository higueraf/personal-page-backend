import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { paginate } from '../../common/pagination';
import { hasContentAccess } from '../../common/roles';
import { toSlug } from '../../common/slug.util';
import { VideoCourse } from '../../entities/video-course.entity';
import { VideoLesson } from '../../entities/video-lesson.entity';
import { VideoSection } from '../../entities/video-section.entity';
import { UpsertVideoCourseDto, UpsertVideoLessonDto, UpsertVideoSectionDto } from './dto/video-course.dto';

@Injectable()
export class VideoCoursesService {
  constructor(
    @InjectRepository(VideoCourse) private readonly coursesRepo: Repository<VideoCourse>,
    @InjectRepository(VideoSection) private readonly sectionsRepo: Repository<VideoSection>,
    @InjectRepository(VideoLesson) private readonly lessonsRepo: Repository<VideoLesson>,
  ) {}

  async listCourses(params: any) {
    const where = params?.search ? { title: ILike(`%${params.search}%`) } : {};
    const items = await this.coursesRepo.find({ where, order: { created_at: 'DESC' } });
    return paginate(items, Number(params?.page || 1), 50);
  }

  async getCourse(id: string) { return { data: await this.must(this.coursesRepo, id) }; }

  async createCourse(dto: UpsertVideoCourseDto) {
    const saved = await this.coursesRepo.save(this.coursesRepo.create({ ...dto, slug: dto.slug || toSlug(dto.title), status: dto.status || 'DRAFT' }));
    return { data: saved };
  }

  async updateCourse(id: string, dto: Partial<UpsertVideoCourseDto>) {
    const entity = await this.must(this.coursesRepo, id);
    Object.assign(entity, dto);
    if (dto.title && !dto.slug) entity.slug = toSlug(dto.title);
    return { data: await this.coursesRepo.save(entity) };
  }

  async deleteCourse(id: string) { await this.coursesRepo.delete(id); }

  async listSections(params: any) {
    const where = params?.course_id ? { course: { id: params.course_id } } : {};
    const items = await this.sectionsRepo.find({ where, relations: ['course'], order: { order: 'ASC' } });
    return paginate(items.map((x) => ({ ...x, course: x.course.id })), Number(params?.page || 1), 50);
  }

  async createSection(dto: UpsertVideoSectionDto) {
    const course = await this.must(this.coursesRepo, dto.course);
    const saved = await this.sectionsRepo.save(this.sectionsRepo.create({ course, title: dto.title, order: dto.order || 1 }));
    return { data: { ...saved, course: course.id } };
  }

  async updateSection(id: string, dto: Partial<UpsertVideoSectionDto>) {
    const entity = await this.sectionsRepo.findOne({ where: { id }, relations: ['course'] });
    if (!entity) throw new NotFoundException('Video section not found');
    if (dto.course) entity.course = await this.must(this.coursesRepo, dto.course);
    Object.assign(entity, { ...dto, course: entity.course });
    const saved = await this.sectionsRepo.save(entity);
    return { data: { ...saved, course: saved.course.id } };
  }

  async deleteSection(id: string) { await this.sectionsRepo.delete(id); }

  async listLessons(params: any) {
    const where = params?.section_id ? { section: { id: params.section_id } } : {};
    const items = await this.lessonsRepo.find({ where, relations: ['section'], order: { order: 'ASC' } });
    return paginate(items.map((x) => ({ ...x, section: x.section.id })), Number(params?.page || 1), 50);
  }

  async createLesson(dto: UpsertVideoLessonDto) {
    const section = await this.must(this.sectionsRepo, dto.section);
    const saved = await this.lessonsRepo.save(this.lessonsRepo.create({
      section,
      title: dto.title,
      slug: dto.slug || toSlug(dto.title),
      order: dto.order || 1,
      status: dto.status || 'DRAFT',
      video_type: dto.video_type || 'none',
      video_url: dto.video_url || null,
      video_file: dto.video_file || null,
      duration_seconds: dto.duration_seconds || 0,
      markdown: dto.markdown || '',
      is_free_preview: !!dto.is_free_preview,
    }));
    return { data: { ...saved, section: section.id } };
  }

  async updateLesson(id: string, dto: Partial<UpsertVideoLessonDto>) {
    const entity = await this.lessonsRepo.findOne({ where: { id }, relations: ['section'] });
    if (!entity) throw new NotFoundException('Video lesson not found');
    if (dto.section) entity.section = await this.must(this.sectionsRepo, dto.section);
    if (dto.title && !dto.slug) dto.slug = toSlug(dto.title);
    Object.assign(entity, { ...dto, section: entity.section });
    const saved = await this.lessonsRepo.save(entity);
    return { data: { ...saved, section: saved.section.id } };
  }

  async deleteLesson(id: string) { await this.lessonsRepo.delete(id); }

  async publicList(search?: string, page = 1, pageSize = 12) {
    const where: any = { status: 'PUBLISHED' };
    if (search) where.title = ILike(`%${search}%`);
    const skip = (page - 1) * pageSize;
    const [items, total] = await this.coursesRepo.findAndCount({
      where,
      order: { created_at: 'DESC' },
      skip,
      take: pageSize,
    });
    return {
      data: items,
      meta: { total_records: total, page, page_size: pageSize },
    };
  }

  async publicMeta(slug: string) {
    const course = await this.coursesRepo.findOne({ where: { slug, status: 'PUBLISHED' } });
    if (!course) throw new NotFoundException('Course not found');
    const sections = await this.sectionsRepo.find({ where: { course: { id: course.id } }, order: { order: 'ASC' } });
    const curriculum = [];
    for (const section of sections) {
      const lessons = await this.lessonsRepo.find({ where: { section: { id: section.id }, status: 'PUBLISHED' }, order: { order: 'ASC' } });
      curriculum.push({
        id: section.id,
        title: section.title,
        order: section.order,
        lessons: lessons.map((lesson) => ({
          id: lesson.id,
          title: lesson.title,
          slug: lesson.slug,
          order: lesson.order,
          video_type: lesson.video_type,
          duration_seconds: lesson.duration_seconds,
          is_free_preview: lesson.is_free_preview,
        })),
      });
    }
    return { ...course, curriculum };
  }

  async publicLesson(courseSlug: string, lessonSlug: string, user?: any) {
    const course = await this.coursesRepo.findOne({ where: { slug: courseSlug, status: 'PUBLISHED' } });
    if (!course) throw new NotFoundException('Course not found');
    const lesson = await this.lessonsRepo.findOne({ where: { slug: lessonSlug, section: { course: { id: course.id } }, status: 'PUBLISHED' }, relations: ['section'] });
    if (!lesson) throw new NotFoundException('Lesson not found');
    if (!lesson.is_free_preview && !hasContentAccess(user?.role?.name)) {
      throw new ForbiddenException('Contenido restringido');
    }
    const flat = await this.flatLessons(course.id);
    const idx = flat.findIndex((x) => x.id === lesson.id);
    return {
      lesson: {
        id: lesson.id,
        title: lesson.title,
        slug: lesson.slug,
        order: lesson.order,
        duration_seconds: lesson.duration_seconds,
      },
      video: {
        type: lesson.video_type,
        embed_url: this.toEmbedUrl(lesson.video_type, lesson.video_url),
        stream_url: lesson.video_type === 'file' && lesson.video_file ? `/api/video-stream/${lesson.id}/` : null,
      },
      markdown: lesson.markdown,
      nav: {
        prev: idx > 0 ? flat[idx - 1].slug : null,
        next: idx >= 0 && idx < flat.length - 1 ? flat[idx + 1].slug : null,
      },
    };
  }

  async getVideoFileByLessonId(lessonId: string) {
    const lesson = await this.lessonsRepo.findOne({ where: { id: lessonId } });
    if (!lesson) throw new NotFoundException('Video lesson not found');
    return lesson.video_file;
  }

  private toEmbedUrl(type?: string, url?: string | null) {
    if (!url) return null;
    if (type === 'youtube') {
      const match = url.match(/(?:v=|youtu\.be\/)([A-Za-z0-9_-]+)/);
      return match?.[1] ? `https://www.youtube.com/embed/${match[1]}` : url;
    }
    if (type === 'vimeo') {
      const match = url.match(/vimeo\.com\/(\d+)/);
      return match?.[1] ? `https://player.vimeo.com/video/${match[1]}` : url;
    }
    return url;
  }

  private async flatLessons(courseId: string) {
    const sections = await this.sectionsRepo.find({ where: { course: { id: courseId } }, order: { order: 'ASC' } });
    const flat: VideoLesson[] = [];
    for (const section of sections) {
      const lessons = await this.lessonsRepo.find({ where: { section: { id: section.id }, status: 'PUBLISHED' }, order: { order: 'ASC' } });
      flat.push(...lessons);
    }
    return flat;
  }

  private async must<T extends { id: string }>(repo: Repository<T>, id: string) {
    const item = await repo.findOne({ where: { id } as any });
    if (!item) throw new NotFoundException(`Resource ${id} not found`);
    return item;
  }
}
