export declare class UpsertVideoCourseDto {
    title: string;
    slug?: string;
    description?: string | null;
    level?: string | null;
    status?: string;
    thumbnail?: string | null;
}
export declare class UpsertVideoSectionDto {
    course: string;
    title: string;
    order?: number;
}
export declare class UpsertVideoLessonDto {
    section: string;
    title: string;
    slug?: string;
    order?: number;
    status?: string;
    video_type?: string;
    video_url?: string | null;
    video_file?: string | null;
    duration_seconds?: number;
    markdown?: string;
    is_free_preview?: boolean;
}
