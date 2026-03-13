import { Request } from 'express';
import { VideoCoursesService } from './video-courses.service';
export declare class VideoCoursesPublicController {
    private readonly service;
    constructor(service: VideoCoursesService);
    list(search?: string): Promise<{
        data: import("../../entities/video-course.entity").VideoCourse[];
    }>;
    meta(slug: string): Promise<{
        curriculum: any[];
        id: string;
        title: string;
        slug: string;
        description: string | null;
        level: string | null;
        status: string;
        thumbnail: string | null;
        sections: import("../../entities/video-section.entity").VideoSection[];
        created_at: Date;
        updated_at: Date;
    }>;
    lesson(courseSlug: string, lessonSlug: string, req: Request & {
        user?: any;
    }): Promise<{
        lesson: {
            id: string;
            title: string;
            slug: string;
            order: number;
            duration_seconds: number;
        };
        video: {
            type: string;
            embed_url: string;
            stream_url: string;
        };
        markdown: string;
        nav: {
            prev: string;
            next: string;
        };
    }>;
}
