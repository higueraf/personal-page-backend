import { Repository } from 'typeorm';
import { ContentBlock } from '../../entities/content-block.entity';
import { Course } from '../../entities/course.entity';
import { CourseSection } from '../../entities/course-section.entity';
import { LessonPage } from '../../entities/lesson-page.entity';
import { Lesson } from '../../entities/lesson.entity';
import { UpsertBlockDto, UpsertCourseDto, UpsertLessonDto, UpsertPageDto, UpsertSectionDto } from './dto/tutorial.dto';
export declare class TutorialsService {
    private readonly coursesRepo;
    private readonly sectionsRepo;
    private readonly lessonsRepo;
    private readonly pagesRepo;
    private readonly blocksRepo;
    constructor(coursesRepo: Repository<Course>, sectionsRepo: Repository<CourseSection>, lessonsRepo: Repository<Lesson>, pagesRepo: Repository<LessonPage>, blocksRepo: Repository<ContentBlock>);
    listCourses(params: any): Promise<{
        data: Course[];
        meta: {
            total_records: number;
            page: number;
            page_size: number;
        };
    }>;
    getCourse(id: string): Promise<{
        data: Course;
    }>;
    createCourse(dto: UpsertCourseDto): Promise<{
        data: Course;
    }>;
    updateCourse(id: string, dto: Partial<UpsertCourseDto>): Promise<{
        data: Course;
    }>;
    deleteCourse(id: string): Promise<void>;
    listSections(params: any): Promise<{
        data: {
            course: string;
            id: string;
            title: string;
            order: number;
            status: string;
            lessons: Lesson[];
        }[];
        meta: {
            total_records: number;
            page: number;
            page_size: number;
        };
    }>;
    getSection(id: string): Promise<{
        data: {
            course: string;
            id: string;
            title: string;
            order: number;
            status: string;
            lessons: Lesson[];
        };
    }>;
    createSection(dto: UpsertSectionDto): Promise<{
        data: {
            course: string;
            id: string;
            title: string;
            order: number;
            status: string;
            lessons: Lesson[];
        };
    }>;
    updateSection(id: string, dto: Partial<UpsertSectionDto>): Promise<{
        data: {
            course: string;
            id: string;
            title: string;
            order: number;
            status: string;
            lessons: Lesson[];
        };
    }>;
    deleteSection(id: string): Promise<void>;
    listLessons(params: any): Promise<{
        data: {
            section: string;
            id: string;
            title: string;
            slug: string;
            summary: string | null;
            order: number;
            status: string;
            pages: LessonPage[];
        }[];
        meta: {
            total_records: number;
            page: number;
            page_size: number;
        };
    }>;
    getLesson(id: string): Promise<{
        data: {
            section: string;
            id: string;
            title: string;
            slug: string;
            summary: string | null;
            order: number;
            status: string;
            pages: LessonPage[];
        };
    }>;
    createLesson(dto: UpsertLessonDto): Promise<{
        data: {
            section: string;
            id: string;
            title: string;
            slug: string;
            summary: string | null;
            order: number;
            status: string;
            pages: LessonPage[];
        };
    }>;
    updateLesson(id: string, dto: Partial<UpsertLessonDto>): Promise<{
        data: {
            section: string;
            id: string;
            title: string;
            slug: string;
            summary: string | null;
            order: number;
            status: string;
            pages: LessonPage[];
        };
    }>;
    deleteLesson(id: string): Promise<void>;
    listPages(params: any): Promise<{
        data: {
            lesson: string;
            id: string;
            title: string | null;
            order: number;
            estimated_minutes: number;
            status: string;
            blocks: ContentBlock[];
        }[];
        meta: {
            total_records: number;
            page: number;
            page_size: number;
        };
    }>;
    getPage(id: string): Promise<{
        data: {
            lesson: string;
            id: string;
            title: string | null;
            order: number;
            estimated_minutes: number;
            status: string;
            blocks: ContentBlock[];
        };
    }>;
    createPage(dto: UpsertPageDto): Promise<{
        data: {
            lesson: string;
            id: string;
            title: string | null;
            order: number;
            estimated_minutes: number;
            status: string;
            blocks: ContentBlock[];
        };
    }>;
    updatePage(id: string, dto: Partial<UpsertPageDto>): Promise<{
        data: {
            lesson: string;
            id: string;
            title: string | null;
            order: number;
            estimated_minutes: number;
            status: string;
            blocks: ContentBlock[];
        };
    }>;
    deletePage(id: string): Promise<void>;
    listBlocks(params: any): Promise<{
        data: {
            page: string;
            id: string;
            type: string;
            order: number;
            data: Record<string, any>;
        }[];
        meta: {
            total_records: number;
            page: number;
            page_size: number;
        };
    }>;
    getBlock(id: string): Promise<{
        data: {
            page: string;
            id: string;
            type: string;
            order: number;
            data: Record<string, any>;
        };
    }>;
    createBlock(dto: UpsertBlockDto): Promise<{
        data: {
            page: string;
            id: string;
            type: string;
            order: number;
            data: Record<string, any>;
        };
    }>;
    updateBlock(id: string, dto: Partial<UpsertBlockDto>): Promise<{
        data: {
            page: string;
            id: string;
            type: string;
            order: number;
            data: Record<string, any>;
        };
    }>;
    deleteBlock(id: string): Promise<void>;
    publicTutorials(search?: string): Promise<{
        data: Course[];
    }>;
    publicTutorialMeta(slug: string): Promise<Course>;
    publicTutorialPages(slug: string, user?: any): Promise<{
        pages: {
            id: string;
            title: string;
            slug: string;
            order: number;
        }[];
    }>;
    publicTutorialContent(courseSlug: string, lessonSlug: string, user?: any): Promise<{
        lesson: {
            title: string;
            slug: string;
            order: number;
        };
        markdown: string;
        nav: {
            prev: string;
            next: string;
        };
    }>;
    publicCourses(params: any): Promise<{
        data: Course[];
        meta: {
            total_records: number;
            page: number;
            page_size: number;
        };
    }>;
    publicCourse(slug: string): Promise<Course>;
    publicCurriculum(slug: string): Promise<{
        course: {
            title: string;
            slug: string;
        };
        curriculum: any[];
    }>;
    publicLessonPage(courseSlug: string, lessonSlug: string, pageOrder: number): Promise<{
        course: {
            title: string;
            slug: string;
        };
        lesson: {
            title: string;
            slug: string;
        };
        page: {
            title: string;
            order: number;
            estimated_minutes: number;
            total_pages: number;
        };
        blocks: {
            id: string;
            type: string;
            order: number;
            data: Record<string, any>;
        }[];
        nav: {
            prev: number;
            next: number;
        };
    }>;
    private allPublishedLessonsByCourse;
    private blockToMarkdown;
    private must;
}
