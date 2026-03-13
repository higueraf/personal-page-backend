import { Course } from './course.entity';
import { Lesson } from './lesson.entity';
export declare class CourseSection {
    id: string;
    course: Course;
    title: string;
    order: number;
    status: string;
    lessons: Lesson[];
}
