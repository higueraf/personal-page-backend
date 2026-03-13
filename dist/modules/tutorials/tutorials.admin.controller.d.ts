import { TutorialsService } from './tutorials.service';
import { UpsertBlockDto, UpsertCourseDto, UpsertLessonDto, UpsertPageDto, UpsertSectionDto } from './dto/tutorial.dto';
export declare class TutorialsAdminController {
    private readonly service;
    constructor(service: TutorialsService);
    listCourses(q: any): Promise<{
        data: import("../../entities/course.entity").Course[];
        meta: {
            total_records: number;
            page: number;
            page_size: number;
        };
    }>;
    getCourse(id: string): Promise<{
        data: import("../../entities/course.entity").Course;
    }>;
    createCourse(dto: UpsertCourseDto): Promise<{
        data: import("../../entities/course.entity").Course;
    }>;
    updateCourse(id: string, dto: Partial<UpsertCourseDto>): Promise<{
        data: import("../../entities/course.entity").Course;
    }>;
    deleteCourse(id: string): Promise<void>;
    listSections(q: any): Promise<{
        data: {
            course: string;
            id: string;
            title: string;
            order: number;
            status: string;
            lessons: import("../../entities/lesson.entity").Lesson[];
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
            lessons: import("../../entities/lesson.entity").Lesson[];
        };
    }>;
    createSection(dto: UpsertSectionDto): Promise<{
        data: {
            course: string;
            id: string;
            title: string;
            order: number;
            status: string;
            lessons: import("../../entities/lesson.entity").Lesson[];
        };
    }>;
    updateSection(id: string, dto: Partial<UpsertSectionDto>): Promise<{
        data: {
            course: string;
            id: string;
            title: string;
            order: number;
            status: string;
            lessons: import("../../entities/lesson.entity").Lesson[];
        };
    }>;
    deleteSection(id: string): Promise<void>;
    listLessons(q: any): Promise<{
        data: {
            section: string;
            id: string;
            title: string;
            slug: string;
            summary: string | null;
            order: number;
            status: string;
            pages: import("../../entities/lesson-page.entity").LessonPage[];
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
            pages: import("../../entities/lesson-page.entity").LessonPage[];
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
            pages: import("../../entities/lesson-page.entity").LessonPage[];
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
            pages: import("../../entities/lesson-page.entity").LessonPage[];
        };
    }>;
    deleteLesson(id: string): Promise<void>;
    listPages(q: any): Promise<{
        data: {
            lesson: string;
            id: string;
            title: string | null;
            order: number;
            estimated_minutes: number;
            status: string;
            blocks: import("../../entities/content-block.entity").ContentBlock[];
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
            blocks: import("../../entities/content-block.entity").ContentBlock[];
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
            blocks: import("../../entities/content-block.entity").ContentBlock[];
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
            blocks: import("../../entities/content-block.entity").ContentBlock[];
        };
    }>;
    deletePage(id: string): Promise<void>;
    listBlocks(q: any): Promise<{
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
}
