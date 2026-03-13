import { VideoCourse } from './video-course.entity';
import { VideoLesson } from './video-lesson.entity';
export declare class VideoSection {
    id: string;
    course: VideoCourse;
    title: string;
    order: number;
    lessons: VideoLesson[];
}
