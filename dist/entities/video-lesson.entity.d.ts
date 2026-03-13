import { VideoSection } from './video-section.entity';
export declare class VideoLesson {
    id: string;
    section: VideoSection;
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
}
