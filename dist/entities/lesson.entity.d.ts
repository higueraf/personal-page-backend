import { CourseSection } from './course-section.entity';
import { LessonPage } from './lesson-page.entity';
export declare class Lesson {
    id: string;
    section: CourseSection;
    title: string;
    slug: string;
    summary: string | null;
    order: number;
    status: string;
    pages: LessonPage[];
}
