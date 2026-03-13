import { Response } from 'express';
import { VideoCoursesService } from './video-courses.service';
export declare class VideoStreamController {
    private readonly service;
    constructor(service: VideoCoursesService);
    stream(lessonId: string, res: Response): Promise<void | Response<any, Record<string, any>>>;
}
