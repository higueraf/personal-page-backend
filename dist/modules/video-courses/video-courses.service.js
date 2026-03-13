"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VideoCoursesService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const pagination_1 = require("../../common/pagination");
const roles_1 = require("../../common/roles");
const slug_util_1 = require("../../common/slug.util");
const video_course_entity_1 = require("../../entities/video-course.entity");
const video_lesson_entity_1 = require("../../entities/video-lesson.entity");
const video_section_entity_1 = require("../../entities/video-section.entity");
let VideoCoursesService = class VideoCoursesService {
    constructor(coursesRepo, sectionsRepo, lessonsRepo) {
        this.coursesRepo = coursesRepo;
        this.sectionsRepo = sectionsRepo;
        this.lessonsRepo = lessonsRepo;
    }
    async listCourses(params) {
        const where = params?.search ? { title: (0, typeorm_2.ILike)(`%${params.search}%`) } : {};
        const items = await this.coursesRepo.find({ where, order: { created_at: 'DESC' } });
        return (0, pagination_1.paginate)(items, Number(params?.page || 1), 50);
    }
    async getCourse(id) { return { data: await this.must(this.coursesRepo, id) }; }
    async createCourse(dto) {
        const saved = await this.coursesRepo.save(this.coursesRepo.create({ ...dto, slug: dto.slug || (0, slug_util_1.toSlug)(dto.title), status: dto.status || 'DRAFT' }));
        return { data: saved };
    }
    async updateCourse(id, dto) {
        const entity = await this.must(this.coursesRepo, id);
        Object.assign(entity, dto);
        if (dto.title && !dto.slug)
            entity.slug = (0, slug_util_1.toSlug)(dto.title);
        return { data: await this.coursesRepo.save(entity) };
    }
    async deleteCourse(id) { await this.coursesRepo.delete(id); }
    async listSections(params) {
        const where = params?.course_id ? { course: { id: params.course_id } } : {};
        const items = await this.sectionsRepo.find({ where, relations: ['course'], order: { order: 'ASC' } });
        return (0, pagination_1.paginate)(items.map((x) => ({ ...x, course: x.course.id })), Number(params?.page || 1), 50);
    }
    async createSection(dto) {
        const course = await this.must(this.coursesRepo, dto.course);
        const saved = await this.sectionsRepo.save(this.sectionsRepo.create({ course, title: dto.title, order: dto.order || 1 }));
        return { data: { ...saved, course: course.id } };
    }
    async updateSection(id, dto) {
        const entity = await this.sectionsRepo.findOne({ where: { id }, relations: ['course'] });
        if (!entity)
            throw new common_1.NotFoundException('Video section not found');
        if (dto.course)
            entity.course = await this.must(this.coursesRepo, dto.course);
        Object.assign(entity, { ...dto, course: entity.course });
        const saved = await this.sectionsRepo.save(entity);
        return { data: { ...saved, course: saved.course.id } };
    }
    async deleteSection(id) { await this.sectionsRepo.delete(id); }
    async listLessons(params) {
        const where = params?.section_id ? { section: { id: params.section_id } } : {};
        const items = await this.lessonsRepo.find({ where, relations: ['section'], order: { order: 'ASC' } });
        return (0, pagination_1.paginate)(items.map((x) => ({ ...x, section: x.section.id })), Number(params?.page || 1), 50);
    }
    async createLesson(dto) {
        const section = await this.must(this.sectionsRepo, dto.section);
        const saved = await this.lessonsRepo.save(this.lessonsRepo.create({
            section,
            title: dto.title,
            slug: dto.slug || (0, slug_util_1.toSlug)(dto.title),
            order: dto.order || 1,
            status: dto.status || 'DRAFT',
            video_type: dto.video_type || 'none',
            video_url: dto.video_url || null,
            video_file: dto.video_file || null,
            duration_seconds: dto.duration_seconds || 0,
            markdown: dto.markdown || '',
            is_free_preview: !!dto.is_free_preview,
        }));
        return { data: { ...saved, section: section.id } };
    }
    async updateLesson(id, dto) {
        const entity = await this.lessonsRepo.findOne({ where: { id }, relations: ['section'] });
        if (!entity)
            throw new common_1.NotFoundException('Video lesson not found');
        if (dto.section)
            entity.section = await this.must(this.sectionsRepo, dto.section);
        if (dto.title && !dto.slug)
            dto.slug = (0, slug_util_1.toSlug)(dto.title);
        Object.assign(entity, { ...dto, section: entity.section });
        const saved = await this.lessonsRepo.save(entity);
        return { data: { ...saved, section: saved.section.id } };
    }
    async deleteLesson(id) { await this.lessonsRepo.delete(id); }
    async publicList(search) {
        const where = { status: 'PUBLISHED' };
        if (search)
            where.title = (0, typeorm_2.ILike)(`%${search}%`);
        const items = await this.coursesRepo.find({ where, order: { created_at: 'DESC' } });
        return { data: items };
    }
    async publicMeta(slug) {
        const course = await this.coursesRepo.findOne({ where: { slug, status: 'PUBLISHED' } });
        if (!course)
            throw new common_1.NotFoundException('Course not found');
        const sections = await this.sectionsRepo.find({ where: { course: { id: course.id } }, order: { order: 'ASC' } });
        const curriculum = [];
        for (const section of sections) {
            const lessons = await this.lessonsRepo.find({ where: { section: { id: section.id }, status: 'PUBLISHED' }, order: { order: 'ASC' } });
            curriculum.push({
                id: section.id,
                title: section.title,
                order: section.order,
                lessons: lessons.map((lesson) => ({
                    id: lesson.id,
                    title: lesson.title,
                    slug: lesson.slug,
                    order: lesson.order,
                    video_type: lesson.video_type,
                    duration_seconds: lesson.duration_seconds,
                    is_free_preview: lesson.is_free_preview,
                })),
            });
        }
        return { ...course, curriculum };
    }
    async publicLesson(courseSlug, lessonSlug, user) {
        const course = await this.coursesRepo.findOne({ where: { slug: courseSlug, status: 'PUBLISHED' } });
        if (!course)
            throw new common_1.NotFoundException('Course not found');
        const lesson = await this.lessonsRepo.findOne({ where: { slug: lessonSlug, section: { course: { id: course.id } }, status: 'PUBLISHED' }, relations: ['section'] });
        if (!lesson)
            throw new common_1.NotFoundException('Lesson not found');
        if (!lesson.is_free_preview && !(0, roles_1.hasContentAccess)(user?.role?.name)) {
            throw new common_1.ForbiddenException('Contenido restringido');
        }
        const flat = await this.flatLessons(course.id);
        const idx = flat.findIndex((x) => x.id === lesson.id);
        return {
            lesson: {
                id: lesson.id,
                title: lesson.title,
                slug: lesson.slug,
                order: lesson.order,
                duration_seconds: lesson.duration_seconds,
            },
            video: {
                type: lesson.video_type,
                embed_url: this.toEmbedUrl(lesson.video_type, lesson.video_url),
                stream_url: lesson.video_type === 'file' && lesson.video_file ? `/api/video-stream/${lesson.id}/` : null,
            },
            markdown: lesson.markdown,
            nav: {
                prev: idx > 0 ? flat[idx - 1].slug : null,
                next: idx >= 0 && idx < flat.length - 1 ? flat[idx + 1].slug : null,
            },
        };
    }
    async getVideoFileByLessonId(lessonId) {
        const lesson = await this.lessonsRepo.findOne({ where: { id: lessonId } });
        if (!lesson)
            throw new common_1.NotFoundException('Video lesson not found');
        return lesson.video_file;
    }
    toEmbedUrl(type, url) {
        if (!url)
            return null;
        if (type === 'youtube') {
            const match = url.match(/(?:v=|youtu\.be\/)([A-Za-z0-9_-]+)/);
            return match?.[1] ? `https://www.youtube.com/embed/${match[1]}` : url;
        }
        if (type === 'vimeo') {
            const match = url.match(/vimeo\.com\/(\d+)/);
            return match?.[1] ? `https://player.vimeo.com/video/${match[1]}` : url;
        }
        return url;
    }
    async flatLessons(courseId) {
        const sections = await this.sectionsRepo.find({ where: { course: { id: courseId } }, order: { order: 'ASC' } });
        const flat = [];
        for (const section of sections) {
            const lessons = await this.lessonsRepo.find({ where: { section: { id: section.id }, status: 'PUBLISHED' }, order: { order: 'ASC' } });
            flat.push(...lessons);
        }
        return flat;
    }
    async must(repo, id) {
        const item = await repo.findOne({ where: { id } });
        if (!item)
            throw new common_1.NotFoundException(`Resource ${id} not found`);
        return item;
    }
};
exports.VideoCoursesService = VideoCoursesService;
exports.VideoCoursesService = VideoCoursesService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(video_course_entity_1.VideoCourse)),
    __param(1, (0, typeorm_1.InjectRepository)(video_section_entity_1.VideoSection)),
    __param(2, (0, typeorm_1.InjectRepository)(video_lesson_entity_1.VideoLesson)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository])
], VideoCoursesService);
//# sourceMappingURL=video-courses.service.js.map