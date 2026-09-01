import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { unlink } from 'fs/promises';
import { join } from 'path';
import { LmsActivity } from '../../entities/lms-activity.entity';
import { LmsSubmission, LmsSubmissionStatus } from '../../entities/lms-submission.entity';
import { LmsSubmissionFile } from '../../entities/lms-submission-file.entity';
import { User } from '../../entities/user.entity';
import { GradeSubmissionDto, SubmitAssignmentDto } from './dto/lms.dto';
import { LmsCoursesService } from './lms-courses.service';
import { LmsActivitiesService } from './lms-activities.service';

/** Tareas (assignment) y exámenes formales de revisión manual (exam con config.mode='manual') comparten esta tabla. */
@Injectable()
export class LmsAssignmentsService {
  constructor(
    @InjectRepository(LmsActivity) private readonly activitiesRepo: Repository<LmsActivity>,
    @InjectRepository(LmsSubmission) private readonly submissionsRepo: Repository<LmsSubmission>,
    @InjectRepository(LmsSubmissionFile) private readonly submissionFilesRepo: Repository<LmsSubmissionFile>,
    private readonly coursesService: LmsCoursesService,
    private readonly activitiesService: LmsActivitiesService,
  ) {}

  private async activityOrFail(id: string) {
    const activity = await this.activitiesRepo.findOne({
      where: { id, type: In(['assignment', 'exam']) },
      relations: ['unit'],
    });
    if (!activity) throw new NotFoundException('Actividad no encontrada');
    return activity;
  }

  async mySubmission(activityId: string, student: User) {
    const activity = await this.activityOrFail(activityId);
    if (activity.status !== 'PUBLISHED') throw new NotFoundException('Actividad no encontrada');
    await this.coursesService.assertEnrolled(activity.unit.course_id, student);
    return this.submissionsRepo.findOne({
      where: { activity_id: activityId, student_id: student.id },
      relations: ['files'],
    });
  }

  async submit(activityId: string, dto: SubmitAssignmentDto, student: User) {
    const activity = await this.activityOrFail(activityId);
    if (activity.status !== 'PUBLISHED') throw new NotFoundException('Actividad no encontrada');
    await this.coursesService.assertEnrolled(activity.unit.course_id, student);
    if (!dto.content_text && !dto.file_url) {
      throw new BadRequestException('La entrega debe incluir texto o un archivo');
    }

    let submission = await this.submissionsRepo.findOne({ where: { activity_id: activityId, student_id: student.id } });
    const isLate = !!activity.due_at && new Date() > activity.due_at;
    if (!submission) {
      submission = this.submissionsRepo.create({ activity_id: activityId, student_id: student.id });
    }
    submission.content_text = dto.content_text ?? null;
    submission.file_url = dto.file_url;
    submission.status = isLate ? LmsSubmissionStatus.LATE : LmsSubmissionStatus.SUBMITTED;
    submission.submitted_at = new Date();
    return this.submissionsRepo.save(submission);
  }

  async listSubmissions(activityId: string, user: User) {
    const activity = await this.activityOrFail(activityId);
    await this.coursesService.getForManage(activity.unit.course_id, user);
    return this.submissionsRepo.find({
      where: { activity_id: activityId },
      relations: ['student', 'files'],
      order: { submitted_at: 'DESC' },
    });
  }

  /** Entrega con uno o varios archivos subidos desde el navegador (multipart). Reemplaza los archivos de la entrega anterior, si había. */
  async submitFiles(
    activityId: string,
    files: Express.Multer.File[],
    contentText: string | undefined,
    student: User,
  ) {
    const activity = await this.activityOrFail(activityId);
    if (activity.status !== 'PUBLISHED') throw new NotFoundException('Actividad no encontrada');
    await this.coursesService.assertEnrolled(activity.unit.course_id, student);
    if (!contentText && files.length === 0) {
      throw new BadRequestException('La entrega debe incluir texto o al menos un archivo');
    }

    let submission = await this.submissionsRepo.findOne({
      where: { activity_id: activityId, student_id: student.id },
      relations: ['files'],
    });
    const isLate = !!activity.due_at && new Date() > activity.due_at;
    if (!submission) {
      submission = this.submissionsRepo.create({ activity_id: activityId, student_id: student.id });
    } else if (submission.files?.length) {
      await Promise.allSettled(
        submission.files.map((f) => unlink(join(process.cwd(), f.file_url.replace(/^\//, '')))),
      );
      await this.submissionFilesRepo.delete({ submission_id: submission.id });
    }
    submission.content_text = contentText ?? null;
    submission.status = isLate ? LmsSubmissionStatus.LATE : LmsSubmissionStatus.SUBMITTED;
    submission.submitted_at = new Date();
    const saved = await this.submissionsRepo.save(submission);

    if (files.length > 0) {
      const fileRows = files.map((f) =>
        this.submissionFilesRepo.create({
          submission_id: saved.id,
          file_url: `/uploads/lms-submissions/${f.filename}`,
          original_name: f.originalname,
          mime_type: f.mimetype,
          size_bytes: f.size,
        }),
      );
      await this.submissionFilesRepo.save(fileRows);
    }

    return this.submissionsRepo.findOne({ where: { id: saved.id }, relations: ['files'] });
  }

  async grade(submissionId: string, dto: GradeSubmissionDto, gradedBy: User) {
    const submission = await this.submissionsRepo.findOne({ where: { id: submissionId } });
    if (!submission) throw new NotFoundException('Entrega no encontrada');
    const activity = await this.activityOrFail(submission.activity_id);
    await this.coursesService.getForManage(activity.unit.course_id, gradedBy);

    submission.grade = dto.grade;
    submission.feedback = dto.feedback ?? null;
    submission.status = LmsSubmissionStatus.GRADED;
    submission.graded_by_id = gradedBy.id;
    submission.graded_at = new Date();
    const saved = await this.submissionsRepo.save(submission);

    await this.activitiesService.markCompleted(activity.id, activity.unit.course_id, submission.student_id, dto.grade);
    return saved;
  }
}
