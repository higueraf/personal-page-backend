import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { paginate } from '../../common/pagination';
import { hasContentAccess } from '../../common/roles';
import { toSlug } from '../../common/slug.util';
import { ContentBlock } from '../../entities/content-block.entity';
import { Course } from '../../entities/course.entity';
import { CourseSection } from '../../entities/course-section.entity';
import { LessonPage } from '../../entities/lesson-page.entity';
import { Lesson } from '../../entities/lesson.entity';
import { UpsertBlockDto, UpsertCourseDto, UpsertLessonDto, UpsertPageDto, UpsertSectionDto } from './dto/tutorial.dto';

@Injectable()
export class TutorialsService {
  constructor(
    @InjectRepository(Course) private readonly coursesRepo: Repository<Course>,
    @InjectRepository(CourseSection) private readonly sectionsRepo: Repository<CourseSection>,
    @InjectRepository(Lesson) private readonly lessonsRepo: Repository<Lesson>,
    @InjectRepository(LessonPage) private readonly pagesRepo: Repository<LessonPage>,
    @InjectRepository(ContentBlock) private readonly blocksRepo: Repository<ContentBlock>,
  ) {}

  async listCourses(params: any) {
    const where = params?.search ? { title: ILike(`%${params.search}%`) } : {};
    const items = await this.coursesRepo.find({ where, order: { created_at: 'DESC' } });
    return paginate(items, Number(params?.page || 1), Number(params?.page_size || 50));
  }

  async getCourse(id: string) { return { data: await this.must(this.coursesRepo, id) }; }

  async createCourse(dto: UpsertCourseDto) {
    const saved = await this.coursesRepo.save(this.coursesRepo.create({
      ...dto,
      slug: dto.slug || toSlug(dto.title),
      status: dto.status || 'DRAFT',
    }));
    return { data: saved };
  }

  async updateCourse(id: string, dto: Partial<UpsertCourseDto>) {
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

  async getSection(id: string) {
    const section = await this.sectionsRepo.findOne({ where: { id }, relations: ['course'] });
    if (!section) throw new NotFoundException('Section not found');
    return { data: { ...section, course: section.course.id } };
  }

  async createSection(dto: UpsertSectionDto) {
    const course = await this.must(this.coursesRepo, dto.course);
    const saved = await this.sectionsRepo.save(this.sectionsRepo.create({
      course,
      title: dto.title,
      order: dto.order || 1,
      status: dto.status || 'DRAFT',
    }));
    return { data: { ...saved, course: course.id } };
  }

  async updateSection(id: string, dto: Partial<UpsertSectionDto>) {
    const section = await this.sectionsRepo.findOne({ where: { id }, relations: ['course'] });
    if (!section) throw new NotFoundException('Section not found');
    if (dto.course) section.course = await this.must(this.coursesRepo, dto.course);
    Object.assign(section, { ...dto, course: section.course });
    const saved = await this.sectionsRepo.save(section);
    return { data: { ...saved, course: saved.course.id } };
  }

  async deleteSection(id: string) { await this.sectionsRepo.delete(id); }

  async listLessons(params: any) {
    const where: any = {};
    if (params?.section_id) where.section = { id: params.section_id };
    if (params?.search) where.title = ILike(`%${params.search}%`);
    const items = await this.lessonsRepo.find({ where, relations: ['section'], order: { order: 'ASC' } });
    return paginate(items.map((x) => ({ ...x, section: x.section.id })), Number(params?.page || 1), 50);
  }

  async getLesson(id: string) {
    const lesson = await this.lessonsRepo.findOne({ where: { id }, relations: ['section'] });
    if (!lesson) throw new NotFoundException('Lesson not found');
    return { data: { ...lesson, section: lesson.section.id } };
  }

  async createLesson(dto: UpsertLessonDto) {
    const section = await this.must(this.sectionsRepo, dto.section);
    const saved = await this.lessonsRepo.save(this.lessonsRepo.create({
      section,
      title: dto.title,
      slug: dto.slug || toSlug(dto.title),
      summary: dto.summary || null,
      order: dto.order || 1,
      status: dto.status || 'DRAFT',
    }));
    return { data: { ...saved, section: section.id } };
  }

  async updateLesson(id: string, dto: Partial<UpsertLessonDto>) {
    const lesson = await this.lessonsRepo.findOne({ where: { id }, relations: ['section'] });
    if (!lesson) throw new NotFoundException('Lesson not found');
    if (dto.section) lesson.section = await this.must(this.sectionsRepo, dto.section);
    if (dto.title && !dto.slug) dto.slug = toSlug(dto.title);
    Object.assign(lesson, { ...dto, section: lesson.section });
    const saved = await this.lessonsRepo.save(lesson);
    return { data: { ...saved, section: saved.section.id } };
  }

  async deleteLesson(id: string) { await this.lessonsRepo.delete(id); }

  async listPages(params: any) {
    const where = params?.lesson_id ? { lesson: { id: params.lesson_id } } : {};
    const items = await this.pagesRepo.find({ where, relations: ['lesson'], order: { order: 'ASC' } });
    return paginate(items.map((x) => ({ ...x, lesson: x.lesson.id })), Number(params?.page || 1), 50);
  }

  async getPage(id: string) {
    const page = await this.pagesRepo.findOne({ where: { id }, relations: ['lesson'] });
    if (!page) throw new NotFoundException('Page not found');
    return { data: { ...page, lesson: page.lesson.id } };
  }

  async createPage(dto: UpsertPageDto) {
    const lesson = await this.must(this.lessonsRepo, dto.lesson);
    const saved = await this.pagesRepo.save(this.pagesRepo.create({
      lesson,
      title: dto.title || null,
      order: dto.order || 1,
      estimated_minutes: dto.estimated_minutes || 5,
      status: dto.status || 'DRAFT',
    }));
    return { data: { ...saved, lesson: lesson.id } };
  }

  async updatePage(id: string, dto: Partial<UpsertPageDto>) {
    const page = await this.pagesRepo.findOne({ where: { id }, relations: ['lesson'] });
    if (!page) throw new NotFoundException('Page not found');
    if (dto.lesson) page.lesson = await this.must(this.lessonsRepo, dto.lesson);
    Object.assign(page, { ...dto, lesson: page.lesson });
    const saved = await this.pagesRepo.save(page);
    return { data: { ...saved, lesson: saved.lesson.id } };
  }

  async deletePage(id: string) { await this.pagesRepo.delete(id); }

  async listBlocks(params: any) {
    const where = params?.page_id ? { page: { id: params.page_id } } : {};
    const items = await this.blocksRepo.find({ where, relations: ['page'], order: { order: 'ASC' } });
    return paginate(items.map((x) => ({ ...x, page: x.page.id })), Number(params?.page || 1), 100);
  }

  async getBlock(id: string) {
    const block = await this.blocksRepo.findOne({ where: { id }, relations: ['page'] });
    if (!block) throw new NotFoundException('Block not found');
    return { data: { ...block, page: block.page.id } };
  }

  async createBlock(dto: UpsertBlockDto) {
    const page = await this.must(this.pagesRepo, dto.page);
    const saved = await this.blocksRepo.save(this.blocksRepo.create({
      page,
      type: dto.type,
      order: dto.order || 1,
      data: dto.data || {},
    }));
    return { data: { ...saved, page: page.id } };
  }

  async updateBlock(id: string, dto: Partial<UpsertBlockDto>) {
    const block = await this.blocksRepo.findOne({ where: { id }, relations: ['page'] });
    if (!block) throw new NotFoundException('Block not found');
    if (dto.page) block.page = await this.must(this.pagesRepo, dto.page);
    Object.assign(block, { ...dto, page: block.page });
    const saved = await this.blocksRepo.save(block);
    return { data: { ...saved, page: saved.page.id } };
  }

  async deleteBlock(id: string) { await this.blocksRepo.delete(id); }

  async publicTutorials(search?: string) {
    const where: any = { status: 'PUBLISHED' };
    if (search) where.title = ILike(`%${search}%`);
    return { data: await this.coursesRepo.find({ where, order: { created_at: 'DESC' } }) };
  }

  async publicTutorialMeta(slug: string) {
    const course = await this.coursesRepo.findOne({ where: { slug, status: 'PUBLISHED' } });
    if (!course) throw new NotFoundException('Tutorial no encontrado');
    return course;
  }

  async publicTutorialPages(slug: string, user?: any) {
    if (!hasContentAccess(user?.role?.name)) throw new ForbiddenException('Contenido restringido');
    const course = await this.coursesRepo.findOne({ where: { slug, status: 'PUBLISHED' } });
    if (!course) throw new NotFoundException('Tutorial no encontrado');
    const sections = await this.sectionsRepo.find({ where: { course: { id: course.id } }, order: { order: 'ASC' } });
    const pages: Array<{ id: string; title: string; slug: string; order: number }> = [];
    let order = 1;
    for (const section of sections) {
      const lessons = await this.lessonsRepo.find({ where: { section: { id: section.id }, status: 'PUBLISHED' }, order: { order: 'ASC' } });
      for (const lesson of lessons) {
        pages.push({ id: lesson.id, title: lesson.title, slug: lesson.slug, order: order++ });
      }
    }
    return { pages };
  }

  async publicTutorialContent(courseSlug: string, lessonSlug: string, user?: any) {
    if (!hasContentAccess(user?.role?.name)) throw new ForbiddenException('Contenido restringido');
    const course = await this.coursesRepo.findOne({ where: { slug: courseSlug, status: 'PUBLISHED' } });
    if (!course) throw new NotFoundException('Tutorial no encontrado');
    const orderedLessons = await this.allPublishedLessonsByCourse(course.id);
    const lesson = orderedLessons.find((x) => x.slug === lessonSlug);
    if (!lesson) throw new NotFoundException('Lección no encontrada');
    const pages = await this.pagesRepo.find({ where: { lesson: { id: lesson.id }, status: 'PUBLISHED' }, order: { order: 'ASC' } });
    const firstPage = pages[0] || null;
    const blocks = firstPage ? await this.blocksRepo.find({ where: { page: { id: firstPage.id } }, order: { order: 'ASC' } }) : [];
    const markdown = blocks.map((b) => (b.type === 'markdown' ? b.data?.markdown || '' : this.blockToMarkdown(b))).join('\n\n');
    const idx = orderedLessons.findIndex((x) => x.id === lesson.id);
    return {
      lesson: { title: lesson.title, slug: lesson.slug, order: lesson.order },
      markdown,
      nav: {
        prev: idx > 0 ? orderedLessons[idx - 1].slug : null,
        next: idx >= 0 && idx < orderedLessons.length - 1 ? orderedLessons[idx + 1].slug : null,
      },
    };
  }

  async publicCourses(params: any) {
    const where: any = { status: 'PUBLISHED' };
    if (params?.search) where.title = ILike(`%${params.search}%`);
    const items = await this.coursesRepo.find({ where, order: { created_at: 'DESC' } });
    return paginate(items, Number(params?.page || 1), Number(params?.page_size || 12));
  }

  async publicCourse(slug: string) {
    const course = await this.coursesRepo.findOne({ where: { slug, status: 'PUBLISHED' } });
    if (!course) throw new NotFoundException('Curso no encontrado');
    return course;
  }

  async publicCurriculum(slug: string) {
    const course = await this.coursesRepo.findOne({ where: { slug, status: 'PUBLISHED' } });
    if (!course) throw new NotFoundException('Curso no encontrado');
    const sections = await this.sectionsRepo.find({ where: { course: { id: course.id } }, order: { order: 'ASC' } });
    const curriculum = [];
    for (const section of sections) {
      const lessons = await this.lessonsRepo.find({ where: { section: { id: section.id }, status: 'PUBLISHED' }, relations: ['pages'], order: { order: 'ASC' } });
      curriculum.push({
        section: { id: section.id, title: section.title, order: section.order },
        lessons: lessons.map((lesson) => ({
          id: lesson.id,
          title: lesson.title,
          slug: lesson.slug,
          order: lesson.order,
          pages_count: lesson.pages?.filter((p) => p.status === 'PUBLISHED').length || 0,
        })),
      });
    }
    return { course: { title: course.title, slug: course.slug }, curriculum };
  }

  async publicLessonPage(courseSlug: string, lessonSlug: string, pageOrder: number) {
    const course = await this.coursesRepo.findOne({ where: { slug: courseSlug, status: 'PUBLISHED' } });
    if (!course) throw new NotFoundException('Curso no encontrado');
    const lesson = await this.lessonsRepo.findOne({
      where: { slug: lessonSlug, status: 'PUBLISHED', section: { course: { id: course.id } } },
      relations: ['section'],
    });
    if (!lesson) throw new NotFoundException('Lección no encontrada');
    const pages = await this.pagesRepo.find({ where: { lesson: { id: lesson.id }, status: 'PUBLISHED' }, order: { order: 'ASC' } });
    const page = pages.find((p) => p.order === Number(pageOrder));
    if (!page) throw new NotFoundException('Página no encontrada');
    const blocks = await this.blocksRepo.find({ where: { page: { id: page.id } }, order: { order: 'ASC' } });
    return {
      course: { title: course.title, slug: course.slug },
      lesson: { title: lesson.title, slug: lesson.slug },
      page: {
        title: page.title,
        order: page.order,
        estimated_minutes: page.estimated_minutes,
        total_pages: pages.length,
      },
      blocks: blocks.map((b) => ({ id: b.id, type: b.type, order: b.order, data: b.data })),
      nav: {
        prev: page.order > 1 ? page.order - 1 : null,
        next: page.order < pages.length ? page.order + 1 : null,
      },
    };
  }

  private async allPublishedLessonsByCourse(courseId: string) {
    const sections = await this.sectionsRepo.find({ where: { course: { id: courseId } }, order: { order: 'ASC' } });
    const flat: Lesson[] = [];
    for (const section of sections) {
      const lessons = await this.lessonsRepo.find({ where: { section: { id: section.id }, status: 'PUBLISHED' }, order: { order: 'ASC' } });
      flat.push(...lessons);
    }
    return flat;
  }

  private blockToMarkdown(block: ContentBlock) {
    if (block.type === 'heading') return `# ${block.data?.text || ''}`.trim();
    if (block.type === 'paragraph') return block.data?.text || '';
    if (block.type === 'list') return Array.isArray(block.data?.items) ? block.data.items.map((x) => `- ${x}`).join('\n') : '';
    if (block.type === 'code') return `\`\`\`${block.data?.language || ''}\n${block.data?.code || ''}\n\`\`\``;
    if (block.type === 'table') return block.data?.markdown || '';
    if (block.type === 'callout') return `> ${block.data?.text || ''}`;
    if (block.type === 'divider') return '---';
    return '';
  }

  private async must<T extends { id: string }>(repo: Repository<T>, id: string) {
    const item = await repo.findOne({ where: { id } as any });
    if (!item) throw new NotFoundException(`Recurso ${id} no encontrado`);
    return item;
  }
}
