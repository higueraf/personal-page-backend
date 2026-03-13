export declare class UpsertCourseDto {
    title: string;
    slug?: string;
    description?: string | null;
    level?: string | null;
    status?: string;
}
export declare class UpsertSectionDto {
    course: string;
    title: string;
    order?: number;
    status?: string;
}
export declare class UpsertLessonDto {
    section: string;
    title: string;
    slug?: string;
    summary?: string | null;
    order?: number;
    status?: string;
}
export declare class UpsertPageDto {
    lesson: string;
    title?: string | null;
    order?: number;
    estimated_minutes?: number;
    status?: string;
}
export declare class UpsertBlockDto {
    page: string;
    type: string;
    order?: number;
    data?: Record<string, any>;
}
