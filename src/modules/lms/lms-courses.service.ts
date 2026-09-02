import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { toSlug } from '../../common/slug.util';
import { paginate } from '../../common/pagination';
import { assertTeacherOwnsCourse } from '../../common/lms-access';
import { LmsCourse, LmsCourseStatus } from '../../entities/lms-course.entity';
import { LmsCourseUnit } from '../../entities/lms-course-unit.entity';
import { LmsActivity } from '../../entities/lms-activity.entity';
import { LmsEnrollment, LmsEnrollmentStatus } from '../../entities/lms-enrollment.entity';
import { LmsActivityProgress, LmsActivityProgressStatus } from '../../entities/lms-activity-progress.entity';
import { StudyCourse } from '../../entities/study-course.entity';
import { User } from '../../entities/user.entity';
import { UpsertLmsCourseDto, UpsertLmsUnitDto } from './dto/lms.dto';

@Injectable()
export class LmsCoursesService {
  constructor(
    @InjectRepository(LmsCourse) private readonly coursesRepo: Repository<LmsCourse>,
    @InjectRepository(LmsCourseUnit) private readonly unitsRepo: Repository<LmsCourseUnit>,
    @InjectRepository(LmsActivity) private readonly activitiesRepo: Repository<LmsActivity>,
    @InjectRepository(LmsEnrollment) private readonly enrollmentsRepo: Repository<LmsEnrollment>,
    @InjectRepository(LmsActivityProgress) private readonly progressRepo: Repository<LmsActivityProgress>,
    @InjectRepository(StudyCourse) private readonly studyCoursesRepo: Repository<StudyCourse>,
    @InjectRepository(User) private readonly usersRepo: Repository<User>,
  ) {}

  // ── Gestión (profesor/admin) ────────────────────────────────────────────────

  async listForTeacher(user: User, query: { search?: string; page?: number; page_size?: number }) {
    const qb = this.coursesRepo.createQueryBuilder('course');
    if (user.role?.name?.toLowerCase() !== 'admin') {
      qb.where('course.teacher_id = :teacherId', { teacherId: user.id });
    }
    if (query.search) {
      qb.andWhere('course.title ILIKE :search', { search: `%${query.search}%` });
    }
    const items = await qb.orderBy('course.created_at', 'DESC').getMany();
    return paginate(items, query.page, query.page_size);
  }

  async getForManage(id: string, user: User) {
    const course = await this.coursesRepo.findOne({ where: { id }, relations: ['study_courses'] });
    if (!course) throw new NotFoundException('Curso no encontrado');
    assertTeacherOwnsCourse(course, user);
    return course;
  }

  async create(dto: UpsertLmsCourseDto, user: User) {
    const slug = toSlug(dto.slug || dto.title);
    const exists = await this.coursesRepo.findOne({ where: { slug } });
    if (exists) throw new BadRequestException('Ya existe un curso con ese slug');

    const study_courses = dto.study_courses?.length
      ? await this.studyCoursesRepo.find({ where: { id: In(dto.study_courses) } })
      : undefined;

    const course = this.coursesRepo.create({
      title: dto.title,
      slug,
      description: dto.description ?? null,
      status: (dto.status as LmsCourseStatus) || LmsCourseStatus.DRAFT,
      cover_image: dto.cover_image,
      teacher_id: user.id,
      study_courses,
    });
    return this.coursesRepo.save(course);
  }

  async update(id: string, dto: Partial<UpsertLmsCourseDto>, user: User) {
    const course = await this.getForManage(id, user);
    if (dto.slug) course.slug = toSlug(dto.slug);
    if (dto.title !== undefined) course.title = dto.title;
    if (dto.description !== undefined) course.description = dto.description ?? null;
    if (dto.status !== undefined) course.status = dto.status as LmsCourseStatus;
    if (dto.cover_image !== undefined) course.cover_image = dto.cover_image;
    if (dto.study_courses) {
      course.study_courses = await this.studyCoursesRepo.find({ where: { id: In(dto.study_courses) } });
    }
    return this.coursesRepo.save(course);
  }

  async archive(id: string, user: User) {
    const course = await this.getForManage(id, user);
    course.status = LmsCourseStatus.ARCHIVED;
    return this.coursesRepo.save(course);
  }

  async createUnit(dto: UpsertLmsUnitDto, user: User) {
    await this.getForManage(dto.course, user);
    const unit = this.unitsRepo.create({
      course_id: dto.course,
      title: dto.title,
      order: dto.order ?? 1,
      status: dto.status || 'DRAFT',
      starts_at: dto.starts_at ? new Date(dto.starts_at) : null,
      ends_at: dto.ends_at ? new Date(dto.ends_at) : null,
    });
    return this.unitsRepo.save(unit);
  }

  async updateUnit(id: string, dto: Partial<UpsertLmsUnitDto>, user: User) {
    const unit = await this.unitsRepo.findOne({ where: { id } });
    if (!unit) throw new NotFoundException('Unidad no encontrada');
    await this.getForManage(unit.course_id, user);
    if (dto.title !== undefined) unit.title = dto.title;
    if (dto.order !== undefined) unit.order = dto.order;
    if (dto.status !== undefined) unit.status = dto.status;
    if (dto.starts_at !== undefined) unit.starts_at = dto.starts_at ? new Date(dto.starts_at) : null;
    if (dto.ends_at !== undefined) unit.ends_at = dto.ends_at ? new Date(dto.ends_at) : null;
    return this.unitsRepo.save(unit);
  }

  /**
   * Organización "por semanas" al estilo Moodle: crea `weeks` unidades consecutivas de 7 días
   * cada una a partir de `startDate`, tituladas con el propio rango de fechas (el profesor puede
   * renombrarlas después si quiere), continuando el `order` desde la última unidad existente.
   */
  async generateWeeklyUnits(courseId: string, startDate: string, weeks: number, user: User) {
    await this.getForManage(courseId, user);
    const [lastUnit] = await this.unitsRepo.find({ where: { course_id: courseId }, order: { order: 'DESC' }, take: 1 });
    let order = (lastUnit?.order ?? 0) + 1;

    // Aritmética en UTC de punta a punta (getUTCDate/setUTCDate + timeZone: 'UTC' al formatear):
    // un <input type="date"> no lleva zona horaria, y con Date/setDate en hora local el resultado
    // termina desfasado un día según la zona horaria del servidor (verificado con un caso real:
    // "2026-04-06" salía formateado como "5 de abril"). En UTC la fecha calendario coincide
    // siempre con lo que el profesor escribió, sin importar dónde corra el servidor.
    const formatter = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'long', timeZone: 'UTC' });
    const created: LmsCourseUnit[] = [];
    const base = new Date(startDate);
    for (let i = 0; i < weeks; i++) {
      const starts_at = new Date(base);
      starts_at.setUTCDate(starts_at.getUTCDate() + i * 7);
      const ends_at = new Date(starts_at);
      ends_at.setUTCDate(ends_at.getUTCDate() + 6);

      const unit = this.unitsRepo.create({
        course_id: courseId,
        title: `${formatter.format(starts_at)} - ${formatter.format(ends_at)}`,
        order: order++,
        status: 'DRAFT',
        starts_at,
        ends_at,
      });
      created.push(await this.unitsRepo.save(unit));
    }
    return created;
  }

  async deleteUnit(id: string, user: User) {
    const unit = await this.unitsRepo.findOne({ where: { id } });
    if (!unit) throw new NotFoundException('Unidad no encontrada');
    await this.getForManage(unit.course_id, user);
    await this.unitsRepo.delete(id);
  }

  async listUnits(courseId: string, user: User) {
    await this.getForManage(courseId, user);
    return this.unitsRepo.find({
      where: { course_id: courseId },
      order: { order: 'ASC' },
      relations: ['activities'],
    });
  }

  async roster(courseId: string, user: User) {
    await this.getForManage(courseId, user);
    const enrollments = await this.enrollmentsRepo.find({
      where: { course_id: courseId },
      relations: ['student'],
      order: { enrolled_at: 'DESC' },
    });
    return enrollments.map((e) => ({
      enrollment_id: e.id,
      status: e.status,
      progress_percent: e.progress_percent,
      last_activity_at: e.last_activity_at,
      enrolled_at: e.enrolled_at,
      student: {
        id: e.student.id,
        first_name: e.student.first_name,
        last_name: e.student.last_name,
        email: e.student.email,
      },
    }));
  }

  // ── Catálogo y consumo (alumno) ──────────────────────────────────────────────

  async publicCatalog(query: { search?: string; study_course_id?: string; page?: number; page_size?: number }) {
    const qb = this.coursesRepo
      .createQueryBuilder('course')
      .leftJoinAndSelect('course.study_courses', 'study_course')
      .where('course.status = :status', { status: LmsCourseStatus.PUBLISHED });
    if (query.search) {
      qb.andWhere('course.title ILIKE :search', { search: `%${query.search}%` });
    }
    if (query.study_course_id) {
      qb.andWhere('study_course.id = :studyCourseId', { studyCourseId: query.study_course_id });
    }
    const items = await qb.orderBy('course.created_at', 'DESC').getMany();
    return paginate(items, query.page, query.page_size);
  }

  async publicDetail(slug: string) {
    const course = await this.coursesRepo.findOne({
      where: { slug, status: LmsCourseStatus.PUBLISHED },
      relations: ['study_courses', 'teacher'],
    });
    if (!course) throw new NotFoundException('Curso no encontrado');
    const units = await this.unitsRepo.find({
      where: { course_id: course.id, status: 'PUBLISHED' },
      order: { order: 'ASC' },
      relations: ['activities'],
    });
    units.forEach((u) => {
      u.activities = (u.activities || [])
        .filter((a) => a.status === 'PUBLISHED')
        .sort((a, b) => a.order - b.order);
    });
    return { ...course, units };
  }

  async enroll(courseId: string, student: User) {
    const course = await this.coursesRepo.findOne({ where: { id: courseId } });
    if (!course || course.status !== LmsCourseStatus.PUBLISHED) {
      throw new NotFoundException('Curso no disponible');
    }
    const existing = await this.enrollmentsRepo.findOne({ where: { course_id: courseId, student_id: student.id } });
    if (existing) return existing;
    const enrollment = this.enrollmentsRepo.create({ course_id: courseId, student_id: student.id });
    return this.enrollmentsRepo.save(enrollment);
  }

  async myCourses(student: User) {
    const enrollments = await this.enrollmentsRepo.find({
      where: { student_id: student.id },
      relations: ['course'],
      order: { last_activity_at: 'DESC' },
    });
    return enrollments.map((e) => ({
      enrollment_id: e.id,
      status: e.status,
      progress_percent: e.progress_percent,
      last_activity_at: e.last_activity_at,
      course: e.course,
    }));
  }

  async assertEnrolled(courseId: string, student: User) {
    const enrollment = await this.enrollmentsRepo.findOne({ where: { course_id: courseId, student_id: student.id } });
    if (!enrollment) throw new ForbiddenException('No estás inscrito en este curso');
    return enrollment;
  }

  /** Recalcula el progreso del curso a partir de LmsActivityProgress; se llama tras completar cualquier actividad. */
  async recalcProgress(courseId: string, studentId: string) {
    const activities = await this.activitiesRepo.find({
      where: { unit: { course_id: courseId }, status: 'PUBLISHED' },
      relations: ['unit'],
    });
    if (activities.length === 0) return;
    const activityIds = activities.map((a) => a.id);
    const completed = await this.progressRepo.count({
      where: { activity_id: In(activityIds), student_id: studentId, status: LmsActivityProgressStatus.COMPLETED },
    });
    const percent = Math.round((completed / activities.length) * 100);
    const enrollment = await this.enrollmentsRepo.findOne({ where: { course_id: courseId, student_id: studentId } });
    if (!enrollment) return;
    enrollment.progress_percent = percent;
    enrollment.last_activity_at = new Date();
    if (percent === 100) enrollment.status = LmsEnrollmentStatus.COMPLETED;
    await this.enrollmentsRepo.save(enrollment);
  }
}
