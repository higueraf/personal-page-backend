import { Repository } from 'typeorm';
import { VideoCourse } from '../../entities/video-course.entity';
import { VideoLesson } from '../../entities/video-lesson.entity';
import { VideoSection } from '../../entities/video-section.entity';
import { UpsertVideoCourseDto, UpsertVideoLessonDto, UpsertVideoSectionDto } from './dto/video-course.dto';
export declare class VideoCoursesService {
    private readonly coursesRepo;
    private readonly sectionsRepo;
    private readonly lessonsRepo;
    constructor(coursesRepo: Repository<VideoCourse>, sectionsRepo: Repository<VideoSection>, lessonsRepo: Repository<VideoLesson>);
    listCourses(params: any): Promise<{
        data: VideoCourse[];
        meta: {
            total_records: number;
            page: number;
            page_size: number;
        };
    }>;
    getCourse(id: string): Promise<{
        data: VideoCourse;
    }>;
    createCourse(dto: UpsertVideoCourseDto): Promise<{
        data: VideoCourse;
    }>;
    updateCourse(id: string, dto: Partial<UpsertVideoCourseDto>): Promise<{
        data: VideoCourse;
    }>;
    deleteCourse(id: string): Promise<void>;
    listSections(params: any): Promise<{
        data: {
            course: string;
            id: string;
            title: string;
            order: number;
            lessons: VideoLesson[];
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
            lessons: VideoLesson[];
        };
    }>;
    updateSection(id: string, dto: Partial<UpsertVideoSectionDto>): Promise<{
        data: {
            course: string;
            id: string;
            title: string;
            order: number;
            lessons: VideoLesson[];
        };
    }>;
    deleteSection(id: string): Promise<void>;
    listLessons(params: any): Promise<{
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
    publicList(search?: string): Promise<{
        data: VideoCourse[];
    }>;
    publicMeta(slug: string): Promise<{
        curriculum: any[];
        id: string;
        title: string;
        slug: string;
        description: string | null;
        level: string | null;
        status: string;
        thumbnail: string | null;
        sections: VideoSection[];
        created_at: Date;
        updated_at: Date;
    }>;
    publicLesson(courseSlug: string, lessonSlug: string, user?: any): Promise<{
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
    getVideoFileByLessonId(lessonId: string): Promise<string>;
    private toEmbedUrl;
    private flatLessons;
    private must;
}
