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
exports.TutorialsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const pagination_1 = require("../../common/pagination");
const roles_1 = require("../../common/roles");
const slug_util_1 = require("../../common/slug.util");
const content_block_entity_1 = require("../../entities/content-block.entity");
const course_entity_1 = require("../../entities/course.entity");
const course_section_entity_1 = require("../../entities/course-section.entity");
const lesson_page_entity_1 = require("../../entities/lesson-page.entity");
const lesson_entity_1 = require("../../entities/lesson.entity");
let TutorialsService = class TutorialsService {
    constructor(coursesRepo, sectionsRepo, lessonsRepo, pagesRepo, blocksRepo) {
        this.coursesRepo = coursesRepo;
        this.sectionsRepo = sectionsRepo;
        this.lessonsRepo = lessonsRepo;
        this.pagesRepo = pagesRepo;
        this.blocksRepo = blocksRepo;
    }
    async listCourses(params) {
        const where = params?.search ? { title: (0, typeorm_2.ILike)(`%${params.search}%`) } : {};
        const items = await this.coursesRepo.find({ where, order: { created_at: 'DESC' } });
        return (0, pagination_1.paginate)(items, Number(params?.page || 1), Number(params?.page_size || 50));
    }
    async getCourse(id) { return { data: await this.must(this.coursesRepo, id) }; }
    async createCourse(dto) {
        const saved = await this.coursesRepo.save(this.coursesRepo.create({
            ...dto,
            slug: dto.slug || (0, slug_util_1.toSlug)(dto.title),
            status: dto.status || 'DRAFT',
        }));
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
    async getSection(id) {
        const section = await this.sectionsRepo.findOne({ where: { id }, relations: ['course'] });
        if (!section)
            throw new common_1.NotFoundException('Section not found');
        return { data: { ...section, course: section.course.id } };
    }
    async createSection(dto) {
        const course = await this.must(this.coursesRepo, dto.course);
        const saved = await this.sectionsRepo.save(this.sectionsRepo.create({
            course,
            title: dto.title,
            order: dto.order || 1,
            status: dto.status || 'DRAFT',
        }));
        return { data: { ...saved, course: course.id } };
    }
    async updateSection(id, dto) {
        const section = await this.sectionsRepo.findOne({ where: { id }, relations: ['course'] });
        if (!section)
            throw new common_1.NotFoundException('Section not found');
        if (dto.course)
            section.course = await this.must(this.coursesRepo, dto.course);
        Object.assign(section, { ...dto, course: section.course });
        const saved = await this.sectionsRepo.save(section);
        return { data: { ...saved, course: saved.course.id } };
    }
    async deleteSection(id) { await this.sectionsRepo.delete(id); }
    async listLessons(params) {
        const where = {};
        if (params?.section_id)
            where.section = { id: params.section_id };
        if (params?.search)
            where.title = (0, typeorm_2.ILike)(`%${params.search}%`);
        const items = await this.lessonsRepo.find({ where, relations: ['section'], order: { order: 'ASC' } });
        return (0, pagination_1.paginate)(items.map((x) => ({ ...x, section: x.section.id })), Number(params?.page || 1), 50);
    }
    async getLesson(id) {
        const lesson = await this.lessonsRepo.findOne({ where: { id }, relations: ['section'] });
        if (!lesson)
            throw new common_1.NotFoundException('Lesson not found');
        return { data: { ...lesson, section: lesson.section.id } };
    }
    async createLesson(dto) {
        const section = await this.must(this.sectionsRepo, dto.section);
        const saved = await this.lessonsRepo.save(this.lessonsRepo.create({
            section,
            title: dto.title,
            slug: dto.slug || (0, slug_util_1.toSlug)(dto.title),
            summary: dto.summary || null,
            order: dto.order || 1,
            status: dto.status || 'DRAFT',
        }));
        return { data: { ...saved, section: section.id } };
    }
    async updateLesson(id, dto) {
        const lesson = await this.lessonsRepo.findOne({ where: { id }, relations: ['section'] });
        if (!lesson)
            throw new common_1.NotFoundException('Lesson not found');
        if (dto.section)
            lesson.section = await this.must(this.sectionsRepo, dto.section);
        if (dto.title && !dto.slug)
            dto.slug = (0, slug_util_1.toSlug)(dto.title);
        Object.assign(lesson, { ...dto, section: lesson.section });
        const saved = await this.lessonsRepo.save(lesson);
        return { data: { ...saved, section: saved.section.id } };
    }
    async deleteLesson(id) { await this.lessonsRepo.delete(id); }
    async listPages(params) {
        const where = params?.lesson_id ? { lesson: { id: params.lesson_id } } : {};
        const items = await this.pagesRepo.find({ where, relations: ['lesson'], order: { order: 'ASC' } });
        return (0, pagination_1.paginate)(items.map((x) => ({ ...x, lesson: x.lesson.id })), Number(params?.page || 1), 50);
    }
    async getPage(id) {
        const page = await this.pagesRepo.findOne({ where: { id }, relations: ['lesson'] });
        if (!page)
            throw new common_1.NotFoundException('Page not found');
        return { data: { ...page, lesson: page.lesson.id } };
    }
    async createPage(dto) {
        const lesson = await this.must(this.lessonsRepo, dto.lesson);
        const saved = await this.pagesRepo.save(this.pagesRepo.create({
            lesson,
            title: dto.title || null,
            order: dto.order || 1,
            estimated_minutes: dto.estimated_minutes || 5,
            status: dto.status || 'DRAFT',
        }));
        return { data: { ...saved, lesson: lesson.id } };
    }
    async updatePage(id, dto) {
        const page = await this.pagesRepo.findOne({ where: { id }, relations: ['lesson'] });
        if (!page)
            throw new common_1.NotFoundException('Page not found');
        if (dto.lesson)
            page.lesson = await this.must(this.lessonsRepo, dto.lesson);
        Object.assign(page, { ...dto, lesson: page.lesson });
        const saved = await this.pagesRepo.save(page);
        return { data: { ...saved, lesson: saved.lesson.id } };
    }
    async deletePage(id) { await this.pagesRepo.delete(id); }
    async listBlocks(params) {
        const where = params?.page_id ? { page: { id: params.page_id } } : {};
        const items = await this.blocksRepo.find({ where, relations: ['page'], order: { order: 'ASC' } });
        return (0, pagination_1.paginate)(items.map((x) => ({ ...x, page: x.page.id })), Number(params?.page || 1), 100);
    }
    async getBlock(id) {
        const block = await this.blocksRepo.findOne({ where: { id }, relations: ['page'] });
        if (!block)
            throw new common_1.NotFoundException('Block not found');
        return { data: { ...block, page: block.page.id } };
    }
    async createBlock(dto) {
        const page = await this.must(this.pagesRepo, dto.page);
        const saved = await this.blocksRepo.save(this.blocksRepo.create({
            page,
            type: dto.type,
            order: dto.order || 1,
            data: dto.data || {},
        }));
        return { data: { ...saved, page: page.id } };
    }
    async updateBlock(id, dto) {
        const block = await this.blocksRepo.findOne({ where: { id }, relations: ['page'] });
        if (!block)
            throw new common_1.NotFoundException('Block not found');
        if (dto.page)
            block.page = await this.must(this.pagesRepo, dto.page);
        Object.assign(block, { ...dto, page: block.page });
        const saved = await this.blocksRepo.save(block);
        return { data: { ...saved, page: saved.page.id } };
    }
    async deleteBlock(id) { await this.blocksRepo.delete(id); }
    async publicTutorials(search) {
        const where = { status: 'PUBLISHED' };
        if (search)
            where.title = (0, typeorm_2.ILike)(`%${search}%`);
        return { data: await this.coursesRepo.find({ where, order: { created_at: 'DESC' } }) };
    }
    async publicTutorialMeta(slug) {
        const course = await this.coursesRepo.findOne({ where: { slug, status: 'PUBLISHED' } });
        if (!course)
            throw new common_1.NotFoundException('Tutorial no encontrado');
        return course;
    }
    async publicTutorialPages(slug, user) {
        if (!(0, roles_1.hasContentAccess)(user?.role?.name))
            throw new common_1.ForbiddenException('Contenido restringido');
        const course = await this.coursesRepo.findOne({ where: { slug, status: 'PUBLISHED' } });
        if (!course)
            throw new common_1.NotFoundException('Tutorial no encontrado');
        const sections = await this.sectionsRepo.find({ where: { course: { id: course.id } }, order: { order: 'ASC' } });
        const pages = [];
        let order = 1;
        for (const section of sections) {
            const lessons = await this.lessonsRepo.find({ where: { section: { id: section.id }, status: 'PUBLISHED' }, order: { order: 'ASC' } });
            for (const lesson of lessons) {
                pages.push({ id: lesson.id, title: lesson.title, slug: lesson.slug, order: order++ });
            }
        }
        return { pages };
    }
    async publicTutorialContent(courseSlug, lessonSlug, user) {
        if (!(0, roles_1.hasContentAccess)(user?.role?.name))
            throw new common_1.ForbiddenException('Contenido restringido');
        const course = await this.coursesRepo.findOne({ where: { slug: courseSlug, status: 'PUBLISHED' } });
        if (!course)
            throw new common_1.NotFoundException('Tutorial no encontrado');
        const orderedLessons = await this.allPublishedLessonsByCourse(course.id);
        const lesson = orderedLessons.find((x) => x.slug === lessonSlug);
        if (!lesson)
            throw new common_1.NotFoundException('Lección no encontrada');
        const pages = await this.pagesRepo.find({ where: { lesson: { id: lesson.id }, status: 'PUBLISHED' }, order: { order: 'ASC' } });
        const firstPage = pages[0] || null;
        const blocks = firstPage ? await this.blocksRepo.find({ where: { page: { id: firstPage.id } }, order: { order: 'ASC' } }) : [];
        const markdown = blocks.map((b) => (b.type === 'markdown' ? b.data?.markdown || '' : this.blockToMarkdown(b))).join('\n\n');
        const idx = orderedLessons.findIndex((x) => x.id === lesson.id);
        return {
            lesson: { title: lesson.title, slug: lesson.slug, order: lesson.order },
            markdown,
            nav: {
                prev: idx > 0 ? orderedLessons[idx - 1].slug : null,
                next: idx >= 0 && idx < orderedLessons.length - 1 ? orderedLessons[idx + 1].slug : null,
            },
        };
    }
    async publicCourses(params) {
        const where = { status: 'PUBLISHED' };
        if (params?.search)
            where.title = (0, typeorm_2.ILike)(`%${params.search}%`);
        const items = await this.coursesRepo.find({ where, order: { created_at: 'DESC' } });
        return (0, pagination_1.paginate)(items, Number(params?.page || 1), Number(params?.page_size || 12));
    }
    async publicCourse(slug) {
        const course = await this.coursesRepo.findOne({ where: { slug, status: 'PUBLISHED' } });
        if (!course)
            throw new common_1.NotFoundException('Curso no encontrado');
        return course;
    }
    async publicCurriculum(slug) {
        const course = await this.coursesRepo.findOne({ where: { slug, status: 'PUBLISHED' } });
        if (!course)
            throw new common_1.NotFoundException('Curso no encontrado');
        const sections = await this.sectionsRepo.find({ where: { course: { id: course.id } }, order: { order: 'ASC' } });
        const curriculum = [];
        for (const section of sections) {
            const lessons = await this.lessonsRepo.find({ where: { section: { id: section.id }, status: 'PUBLISHED' }, relations: ['pages'], order: { order: 'ASC' } });
            curriculum.push({
                section: { id: section.id, title: section.title, order: section.order },
                lessons: lessons.map((lesson) => ({
                    id: lesson.id,
                    title: lesson.title,
                    slug: lesson.slug,
                    order: lesson.order,
                    pages_count: lesson.pages?.filter((p) => p.status === 'PUBLISHED').length || 0,
                })),
            });
        }
        return { course: { title: course.title, slug: course.slug }, curriculum };
    }
    async publicLessonPage(courseSlug, lessonSlug, pageOrder) {
        const course = await this.coursesRepo.findOne({ where: { slug: courseSlug, status: 'PUBLISHED' } });
        if (!course)
            throw new common_1.NotFoundException('Curso no encontrado');
        const lesson = await this.lessonsRepo.findOne({
            where: { slug: lessonSlug, status: 'PUBLISHED', section: { course: { id: course.id } } },
            relations: ['section'],
        });
        if (!lesson)
            throw new common_1.NotFoundException('Lección no encontrada');
        const pages = await this.pagesRepo.find({ where: { lesson: { id: lesson.id }, status: 'PUBLISHED' }, order: { order: 'ASC' } });
        const page = pages.find((p) => p.order === Number(pageOrder));
        if (!page)
            throw new common_1.NotFoundException('Página no encontrada');
        const blocks = await this.blocksRepo.find({ where: { page: { id: page.id } }, order: { order: 'ASC' } });
        return {
            course: { title: course.title, slug: course.slug },
            lesson: { title: lesson.title, slug: lesson.slug },
            page: {
                title: page.title,
                order: page.order,
                estimated_minutes: page.estimated_minutes,
                total_pages: pages.length,
            },
            blocks: blocks.map((b) => ({ id: b.id, type: b.type, order: b.order, data: b.data })),
            nav: {
                prev: page.order > 1 ? page.order - 1 : null,
                next: page.order < pages.length ? page.order + 1 : null,
            },
        };
    }
    async allPublishedLessonsByCourse(courseId) {
        const sections = await this.sectionsRepo.find({ where: { course: { id: courseId } }, order: { order: 'ASC' } });
        const flat = [];
        for (const section of sections) {
            const lessons = await this.lessonsRepo.find({ where: { section: { id: section.id }, status: 'PUBLISHED' }, order: { order: 'ASC' } });
            flat.push(...lessons);
        }
        return flat;
    }
    blockToMarkdown(block) {
        if (block.type === 'heading')
            return `# ${block.data?.text || ''}`.trim();
        if (block.type === 'paragraph')
            return block.data?.text || '';
        if (block.type === 'list')
            return Array.isArray(block.data?.items) ? block.data.items.map((x) => `- ${x}`).join('\n') : '';
        if (block.type === 'code')
            return `\`\`\`${block.data?.language || ''}\n${block.data?.code || ''}\n\`\`\``;
        if (block.type === 'table')
            return block.data?.markdown || '';
        if (block.type === 'callout')
            return `> ${block.data?.text || ''}`;
        if (block.type === 'divider')
            return '---';
        return '';
    }
    async must(repo, id) {
        const item = await repo.findOne({ where: { id } });
        if (!item)
            throw new common_1.NotFoundException(`Recurso ${id} no encontrado`);
        return item;
    }
};
exports.TutorialsService = TutorialsService;
exports.TutorialsService = TutorialsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(course_entity_1.Course)),
    __param(1, (0, typeorm_1.InjectRepository)(course_section_entity_1.CourseSection)),
    __param(2, (0, typeorm_1.InjectRepository)(lesson_entity_1.Lesson)),
    __param(3, (0, typeorm_1.InjectRepository)(lesson_page_entity_1.LessonPage)),
    __param(4, (0, typeorm_1.InjectRepository)(content_block_entity_1.ContentBlock)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository])
], TutorialsService);
//# sourceMappingURL=tutorials.service.js.map