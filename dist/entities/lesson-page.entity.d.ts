import { Lesson } from './lesson.entity';
import { ContentBlock } from './content-block.entity';
export declare class LessonPage {
    id: string;
    lesson: Lesson;
    title: string | null;
    order: number;
    estimated_minutes: number;
    status: string;
    blocks: ContentBlock[];
}
