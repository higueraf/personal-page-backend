import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LmsActivity } from '../../entities/lms-activity.entity';
import { LmsCourseUnit } from '../../entities/lms-course-unit.entity';
import { LmsActivityProgress, LmsActivityProgressStatus } from '../../entities/lms-activity-progress.entity';
import { User } from '../../entities/user.entity';
import { UpsertLmsActivityDto } from './dto/lms.dto';
import { LmsCoursesService } from './lms-courses.service';

@Injectable()
export class LmsActivitiesService {
  constructor(
    @InjectRepository(LmsActivity) private readonly activitiesRepo: Repository<LmsActivity>,
    @InjectRepository(LmsCourseUnit) private readonly unitsRepo: Repository<LmsCourseUnit>,
    @InjectRepository(LmsActivityProgress) private readonly progressRepo: Repository<LmsActivityProgress>,
    private readonly coursesService: LmsCoursesService,
  ) {}

  private async unitOrFail(unitId: string) {
    const unit = await this.unitsRepo.findOne({ where: { id: unitId } });
    if (!unit) throw new NotFoundException('Unidad no encontrada');
    return unit;
  }

  async getForManage(id: string, user: User) {
    const activity = await this.activitiesRepo.findOne({ where: { id }, relations: ['unit'] });
    if (!activity) throw new NotFoundException('Actividad no encontrada');
    await this.coursesService.getForManage(activity.unit.course_id, user);
    return activity;
  }

  async create(dto: UpsertLmsActivityDto, user: User) {
    const unit = await this.unitOrFail(dto.unit);
    await this.coursesService.getForManage(unit.course_id, user);
    const activity = this.activitiesRepo.create({
      unit_id: dto.unit,
      type: dto.type,
      title: dto.title,
      instructions: dto.instructions ?? null,
      order: dto.order ?? 1,
      status: dto.status || 'DRAFT',
      starts_at: dto.starts_at ? new Date(dto.starts_at) : null,
      due_at: dto.due_at ? new Date(dto.due_at) : null,
      max_score: dto.max_score ?? null,
      config: dto.config || {},
    });
    return this.activitiesRepo.save(activity);
  }

  async update(id: string, dto: Partial<UpsertLmsActivityDto>, user: User) {
    const activity = await this.getForManage(id, user);
    if (dto.type !== undefined) activity.type = dto.type;
    if (dto.title !== undefined) activity.title = dto.title;
    if (dto.instructions !== undefined) activity.instructions = dto.instructions ?? null;
    if (dto.order !== undefined) activity.order = dto.order;
    if (dto.status !== undefined) activity.status = dto.status;
    if (dto.starts_at !== undefined) activity.starts_at = dto.starts_at ? new Date(dto.starts_at) : null;
    if (dto.due_at !== undefined) activity.due_at = dto.due_at ? new Date(dto.due_at) : null;
    if (dto.max_score !== undefined) activity.max_score = dto.max_score ?? null;
    if (dto.config !== undefined) activity.config = dto.config;
    return this.activitiesRepo.save(activity);
  }

  async delete(id: string, user: User) {
    await this.getForManage(id, user);
    await this.activitiesRepo.delete(id);
  }

  async listByUnit(unitId: string, user: User) {
    const unit = await this.unitOrFail(unitId);
    await this.coursesService.getForManage(unit.course_id, user);
    return this.activitiesRepo.find({ where: { unit_id: unitId }, order: { order: 'ASC' } });
  }

  /** Vista de alumno: valida inscripción, marca la actividad como vista (IN_PROGRESS) y devuelve su progreso. */
  async studentView(activityId: string, student: User) {
    const activity = await this.activitiesRepo.findOne({ where: { id: activityId }, relations: ['unit', 'unit.course'] });
    if (!activity || activity.status !== 'PUBLISHED') throw new NotFoundException('Actividad no encontrada');
    await this.coursesService.assertEnrolled(activity.unit.course_id, student);
    if (activity.starts_at && new Date() < activity.starts_at) {
      throw new ForbiddenException(`Esta actividad estará disponible a partir del ${activity.starts_at.toLocaleString('es')}.`);
    }

    let progress = await this.progressRepo.findOne({ where: { activity_id: activityId, student_id: student.id } });
    if (!progress) {
      progress = this.progressRepo.create({
        activity_id: activityId,
        student_id: student.id,
        status: LmsActivityProgressStatus.IN_PROGRESS,
      });
    } else if (progress.status === LmsActivityProgressStatus.NOT_STARTED) {
      progress.status = LmsActivityProgressStatus.IN_PROGRESS;
    }
    progress = await this.progressRepo.save(progress);
    return { activity, progress, course_id: activity.unit.course_id, course_slug: activity.unit.course.slug };
  }

  /**
   * Completado manual para actividades sin una entrega/calificación propia
   * (presentaciones, o un examen que redirige a un playground externo). El
   * resto de tipos (foro, tarea, quiz, examen resuelto en la plataforma)
   * se completan a través de su propio flujo — este endpoint no los reemplaza.
   */
  async markViewedComplete(activityId: string, student: User) {
    const activity = await this.activitiesRepo.findOne({ where: { id: activityId }, relations: ['unit'] });
    if (!activity || activity.status !== 'PUBLISHED') throw new NotFoundException('Actividad no encontrada');
    await this.coursesService.assertEnrolled(activity.unit.course_id, student);

    const allowed = activity.type === 'presentation' || (activity.type === 'exam' && activity.config?.mode === 'external');
    if (!allowed) {
      throw new ForbiddenException('Esta actividad se completa entregando la tarea, el quiz o participando en el foro');
    }
    await this.markCompleted(activity.id, activity.unit.course_id, student.id);
    return this.progressRepo.findOne({ where: { activity_id: activityId, student_id: student.id } });
  }

  /** Usado por foro/tareas/quizzes al completar una actividad; recalcula el progreso agregado del curso. */
  async markCompleted(activityId: string, courseId: string, studentId: string, score: number | null = null) {
    let progress = await this.progressRepo.findOne({ where: { activity_id: activityId, student_id: studentId } });
    if (!progress) {
      progress = this.progressRepo.create({ activity_id: activityId, student_id: studentId });
    }
    progress.status = LmsActivityProgressStatus.COMPLETED;
    progress.score = score;
    progress.completed_at = new Date();
    await this.progressRepo.save(progress);
    await this.coursesService.recalcProgress(courseId, studentId);
  }
}
