import { CourseSection } from './course-section.entity';
export declare class Course {
    id: string;
    title: string;
    slug: string;
    description: string | null;
    level: string | null;
    status: string;
    sections: CourseSection[];
    created_at: Date;
    updated_at: Date;
}
