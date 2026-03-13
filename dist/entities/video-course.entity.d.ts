import { VideoSection } from './video-section.entity';
export declare class VideoCourse {
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
}
