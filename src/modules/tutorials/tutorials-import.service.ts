import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { toSlug } from '../../common/slug.util';
import { ContentBlock } from '../../entities/content-block.entity';
import { Course } from '../../entities/course.entity';
import { CourseSection } from '../../entities/course-section.entity';
import { Lesson } from '../../entities/lesson.entity';
import { LessonPage } from '../../entities/lesson-page.entity';
import { ImportTutorialDto } from './dto/import-tutorial.dto';

interface ImportCounts {
  sections: { created: number; updated: number };
  lessons: { created: number; updated: number };
}

@Injectable()
export class TutorialsImportService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async importCourse(dto: ImportTutorialDto) {
    return this.dataSource.transaction(async (manager) => {
      const course = await this.resolveCourse(manager, dto);
      const counts: ImportCounts = { sections: { created: 0, updated: 0 }, lessons: { created: 0, updated: 0 } };

      for (const sectionDto of dto.sections) {
        const section = await this.upsertSection(manager, course, sectionDto, counts);
        for (const lessonDto of sectionDto.lessons) {
          await this.upsertLesson(manager, section, lessonDto, counts);
        }
      }

      return { data: { courseId: course.id, ...counts } };
    });
  }

  private async resolveCourse(manager: EntityManager, dto: ImportTutorialDto): Promise<Course> {
    if (dto.courseId) {
      const course = await manager.findOne(Course, { where: { id: dto.courseId } });
      if (!course) throw new NotFoundException(`Curso ${dto.courseId} no encontrado`);
      return course;
    }
    if (!dto.course) throw new NotFoundException('Se requiere courseId o course para importar');
    const { study_courses: _studyCourses, ...courseDto } = dto.course;
    const created = manager.create(Course, {
      ...courseDto,
      slug: courseDto.slug || toSlug(courseDto.title),
      status: courseDto.status || 'DRAFT',
    });
    return manager.save(created);
  }

  private async upsertSection(
    manager: EntityManager,
    course: Course,
    sectionDto: ImportTutorialDto['sections'][number],
    counts: ImportCounts,
  ): Promise<CourseSection> {
    const existing = await manager.findOne(CourseSection, {
      where: { course: { id: course.id }, order: sectionDto.order },
    });
    if (existing) {
      existing.title = sectionDto.title;
      counts.sections.updated++;
      return manager.save(existing);
    }
    const created = manager.create(CourseSection, {
      course,
      title: sectionDto.title,
      order: sectionDto.order,
      status: 'PUBLISHED',
    });
    counts.sections.created++;
    return manager.save(created);
  }

  private async upsertLesson(
    manager: EntityManager,
    section: CourseSection,
    lessonDto: ImportTutorialDto['sections'][number]['lessons'][number],
    counts: ImportCounts,
  ): Promise<Lesson> {
    let lesson = await manager.findOne(Lesson, { where: { section: { id: section.id }, slug: lessonDto.slug } });
    if (lesson) {
      lesson.title = lessonDto.title;
      lesson.order = lessonDto.order;
      counts.lessons.updated++;
      lesson = await manager.save(lesson);
    } else {
      lesson = manager.create(Lesson, {
        section,
        title: lessonDto.title,
        slug: lessonDto.slug,
        order: lessonDto.order,
        status: 'PUBLISHED',
      });
      counts.lessons.created++;
      lesson = await manager.save(lesson);
    }

    const page = await this.upsertPage(manager, lesson);
    await this.upsertMarkdownBlock(manager, page, lessonDto.markdown);
    return lesson;
  }

  private async upsertPage(manager: EntityManager, lesson: Lesson): Promise<LessonPage> {
    const existing = await manager.findOne(LessonPage, { where: { lesson: { id: lesson.id } } });
    if (existing) return existing;
    const created = manager.create(LessonPage, { lesson, order: 1, status: 'PUBLISHED' });
    return manager.save(created);
  }

  private async upsertMarkdownBlock(manager: EntityManager, page: LessonPage, markdown: string): Promise<ContentBlock> {
    const existing = await manager.findOne(ContentBlock, { where: { page: { id: page.id }, type: 'markdown' } });
    if (existing) {
      existing.data = { markdown };
      return manager.save(existing);
    }
    const created = manager.create(ContentBlock, { page, type: 'markdown', order: 1, data: { markdown } });
    return manager.save(created);
  }
}
