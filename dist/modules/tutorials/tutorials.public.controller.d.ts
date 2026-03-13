import { Request } from 'express';
import { TutorialsService } from './tutorials.service';
export declare class TutorialsPublicController {
    private readonly service;
    constructor(service: TutorialsService);
    listTutorials(search?: string): Promise<{
        data: import("../../entities/course.entity").Course[];
    }>;
    tutorialMeta(slug: string): Promise<import("../../entities/course.entity").Course>;
    tutorialPages(slug: string, req: Request & {
        user?: any;
    }): Promise<{
        pages: {
            id: string;
            title: string;
            slug: string;
            order: number;
        }[];
    }>;
    tutorialContent(courseSlug: string, lessonSlug: string, req: Request & {
        user?: any;
    }): Promise<{
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
    publicCourses(q: any): Promise<{
        data: import("../../entities/course.entity").Course[];
        meta: {
            total_records: number;
            page: number;
            page_size: number;
        };
    }>;
    publicCourse(slug: string): Promise<import("../../entities/course.entity").Course>;
    publicCurriculum(slug: string): Promise<{
        course: {
            title: string;
            slug: string;
        };
        curriculum: any[];
    }>;
    publicLessonPage(courseSlug: string, lessonSlug: string, pageOrder: string): Promise<{
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
}
