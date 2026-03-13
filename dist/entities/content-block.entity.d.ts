import { LessonPage } from './lesson-page.entity';
export declare class ContentBlock {
    id: string;
    page: LessonPage;
    type: string;
    order: number;
    data: Record<string, any>;
}
