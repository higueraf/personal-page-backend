import { UpsertVideoCourseDto, UpsertVideoLessonDto, UpsertVideoSectionDto } from './dto/video-course.dto';
import { VideoCoursesService } from './video-courses.service';
export declare class VideoCoursesAdminController {
    private readonly service;
    constructor(service: VideoCoursesService);
    listCourses(q: any): Promise<{
        data: import("../../entities/video-course.entity").VideoCourse[];
        meta: {
            total_records: number;
            page: number;
            page_size: number;
        };
    }>;
    getCourse(id: string): Promise<{
        data: import("../../entities/video-course.entity").VideoCourse;
    }>;
    createCourse(dto: UpsertVideoCourseDto): Promise<{
        data: import("../../entities/video-course.entity").VideoCourse;
    }>;
    updateCourse(id: string, dto: Partial<UpsertVideoCourseDto>): Promise<{
        data: import("../../entities/video-course.entity").VideoCourse;
    }>;
    deleteCourse(id: string): Promise<void>;
    listSections(q: any): Promise<{
        data: {
            course: string;
            id: string;
            title: string;
            order: number;
            lessons: import("../../entities/video-lesson.entity").VideoLesson[];
        }[];
        meta: {
            total_records: number;
            page: number;
            page_size: number;
        };
    }>;
    createSection(dto: UpsertVideoSectionDto): Promise<{
        data: {
            course: string;
            id: string;
            title: string;
            order: number;
            lessons: import("../../entities/video-lesson.entity").VideoLesson[];
        };
    }>;
    updateSection(id: string, dto: Partial<UpsertVideoSectionDto>): Promise<{
        data: {
            course: string;
            id: string;
            title: string;
            order: number;
            lessons: import("../../entities/video-lesson.entity").VideoLesson[];
        };
    }>;
    deleteSection(id: string): Promise<void>;
    listLessons(q: any): Promise<{
        data: {
            section: string;
            id: string;
            title: string;
            slug: string;
            order: number;
            status: string;
            video_type: string;
            video_url: string | null;
            video_file: string | null;
            duration_seconds: number;
            markdown: string;
            is_free_preview: boolean;
        }[];
        meta: {
            total_records: number;
            page: number;
            page_size: number;
        };
    }>;
    createLesson(dto: UpsertVideoLessonDto): Promise<{
        data: {
            section: string;
            id: string;
            title: string;
            slug: string;
            order: number;
            status: string;
            video_type: string;
            video_url: string | null;
            video_file: string | null;
            duration_seconds: number;
            markdown: string;
            is_free_preview: boolean;
        };
    }>;
    updateLesson(id: string, dto: Partial<UpsertVideoLessonDto>): Promise<{
        data: {
            section: string;
            id: string;
            title: string;
            slug: string;
            order: number;
            status: string;
            video_type: string;
            video_url: string | null;
            video_file: string | null;
            duration_seconds: number;
            markdown: string;
            is_free_preview: boolean;
        };
    }>;
    deleteLesson(id: string): Promise<void>;
}
