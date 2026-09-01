import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LmsActivity } from '../../entities/lms-activity.entity';
import { LmsSurveyQuestion } from '../../entities/lms-survey-question.entity';
import { LmsSurveyOption } from '../../entities/lms-survey-option.entity';
import { LmsSurveyResponse } from '../../entities/lms-survey-response.entity';
import { LmsSurveyAnswer } from '../../entities/lms-survey-answer.entity';
import { User } from '../../entities/user.entity';
import { SubmitSurveyResponseDto, UpsertSurveyQuestionDto } from './dto/lms.dto';
import { LmsCoursesService } from './lms-courses.service';
import { LmsActivitiesService } from './lms-activities.service';
import { parseSurveyMarkdown } from './survey-markdown.parser';

/** Banco de preguntas y respuestas de una encuesta (activity.type 'survey'). Sin corrección: se agregan resultados, no se califica. */
@Injectable()
export class LmsSurveysService {
  constructor(
    @InjectRepository(LmsActivity) private readonly activitiesRepo: Repository<LmsActivity>,
    @InjectRepository(LmsSurveyQuestion) private readonly questionsRepo: Repository<LmsSurveyQuestion>,
    @InjectRepository(LmsSurveyOption) private readonly optionsRepo: Repository<LmsSurveyOption>,
    @InjectRepository(LmsSurveyResponse) private readonly responsesRepo: Repository<LmsSurveyResponse>,
    @InjectRepository(LmsSurveyAnswer) private readonly answersRepo: Repository<LmsSurveyAnswer>,
    private readonly coursesService: LmsCoursesService,
    private readonly activitiesService: LmsActivitiesService,
  ) {}

  private async activityOrFail(id: string) {
    const activity = await this.activitiesRepo.findOne({ where: { id, type: 'survey' }, relations: ['unit'] });
    if (!activity) throw new NotFoundException('Actividad no encontrada');
    return activity;
  }

  // ── Profesor/admin: banco de preguntas ────────────────────────────────────

  async listQuestionsForManage(activityId: string, user: User) {
    const activity = await this.activityOrFail(activityId);
    await this.coursesService.getForManage(activity.unit.course_id, user);
    return this.questionsRepo.find({ where: { activity_id: activityId }, relations: ['options'], order: { order: 'ASC' } });
  }

  async upsertQuestion(dto: UpsertSurveyQuestionDto, user: User) {
    const activity = await this.activityOrFail(dto.activity);
    await this.coursesService.getForManage(activity.unit.course_id, user);

    const question = await this.questionsRepo.save(
      this.questionsRepo.create({
        activity_id: dto.activity,
        text: dto.text,
        type: (dto.type as any) || 'SINGLE_CHOICE',
        order: dto.order ?? 1,
        scale_min: dto.scale_min ?? null,
        scale_max: dto.scale_max ?? null,
      }),
    );

    if (dto.options?.length) {
      const options = dto.options.map((o, idx) =>
        this.optionsRepo.create({ question_id: question.id, text: o.text, order: o.order ?? idx + 1 }),
      );
      question.options = await this.optionsRepo.save(options);
    }
    return question;
  }

  async deleteQuestion(id: string, user: User) {
    const question = await this.questionsRepo.findOne({ where: { id } });
    if (!question) throw new NotFoundException('Pregunta no encontrada');
    const activity = await this.activityOrFail(question.activity_id);
    await this.coursesService.getForManage(activity.unit.course_id, user);
    await this.questionsRepo.delete(id);
  }

  /** Reemplaza todo el banco de preguntas de la encuesta a partir de un archivo Markdown (ver docs/04). */
  async importQuestions(activityId: string, markdown: string, user: User) {
    const activity = await this.activityOrFail(activityId);
    await this.coursesService.getForManage(activity.unit.course_id, user);
    const parsed = parseSurveyMarkdown(markdown);

    await this.questionsRepo.delete({ activity_id: activityId });

    const created: LmsSurveyQuestion[] = [];
    for (let i = 0; i < parsed.questions.length; i++) {
      const q = parsed.questions[i];
      const question = await this.questionsRepo.save(
        this.questionsRepo.create({
          activity_id: activityId,
          text: q.text,
          type: q.type as any,
          order: i + 1,
          scale_min: q.scale_min ?? null,
          scale_max: q.scale_max ?? null,
        }),
      );
      if (q.options.length) {
        question.options = await this.optionsRepo.save(
          q.options.map((text, idx) => this.optionsRepo.create({ question_id: question.id, text, order: idx + 1 })),
        );
      }
      created.push(question);
    }

    if (parsed.anonymous !== undefined) {
      activity.config = { ...activity.config, anonymous: parsed.anonymous };
      await this.activitiesRepo.save(activity);
    }

    return created;
  }

  // ── Alumno ─────────────────────────────────────────────────────────────────

  async listQuestionsForStudent(activityId: string, student: User) {
    const activity = await this.activityOrFail(activityId);
    if (activity.status !== 'PUBLISHED') throw new NotFoundException('Actividad no encontrada');
    await this.coursesService.assertEnrolled(activity.unit.course_id, student);
    const questions = await this.questionsRepo.find({
      where: { activity_id: activityId },
      relations: ['options'],
      order: { order: 'ASC' },
    });
    return questions.map((q) => ({
      id: q.id,
      text: q.text,
      type: q.type,
      order: q.order,
      scale_min: q.scale_min,
      scale_max: q.scale_max,
      options: (q.options || []).map((o) => ({ id: o.id, text: o.text, order: o.order })),
    }));
  }

  async myResponse(activityId: string, student: User) {
    const activity = await this.activityOrFail(activityId);
    if (activity.status !== 'PUBLISHED') throw new NotFoundException('Actividad no encontrada');
    await this.coursesService.assertEnrolled(activity.unit.course_id, student);
    return this.responsesRepo.findOne({ where: { activity_id: activityId, student_id: student.id }, relations: ['answers'] });
  }

  async submitResponse(activityId: string, dto: SubmitSurveyResponseDto, student: User) {
    const activity = await this.activityOrFail(activityId);
    if (activity.status !== 'PUBLISHED') throw new NotFoundException('Actividad no encontrada');
    await this.coursesService.assertEnrolled(activity.unit.course_id, student);
    if (!dto.answers?.length) throw new BadRequestException('La encuesta debe tener al menos una respuesta');

    let response = await this.responsesRepo.findOne({ where: { activity_id: activityId, student_id: student.id } });
    if (!response) {
      response = await this.responsesRepo.save(
        this.responsesRepo.create({ activity_id: activityId, student_id: student.id, submitted_at: new Date() }),
      );
    } else {
      response.submitted_at = new Date();
      await this.responsesRepo.save(response);
      await this.answersRepo.delete({ response_id: response.id });
    }

    const answers = dto.answers.map((a) =>
      this.answersRepo.create({
        response_id: response!.id,
        question_id: a.question_id,
        selected_option_ids: a.selected_option_ids ?? null,
        scale_value: a.scale_value ?? null,
        text_answer: a.text_answer ?? null,
      }),
    );
    await this.answersRepo.save(answers);

    await this.activitiesService.markCompleted(activity.id, activity.unit.course_id, student.id);
    return this.responsesRepo.findOne({ where: { id: response.id }, relations: ['answers'] });
  }

  // ── Profesor/admin: resultados agregados ─────────────────────────────────

  async getResults(activityId: string, user: User) {
    const activity = await this.activityOrFail(activityId);
    await this.coursesService.getForManage(activity.unit.course_id, user);

    const questions = await this.questionsRepo.find({ where: { activity_id: activityId }, relations: ['options'], order: { order: 'ASC' } });
    const responses = await this.responsesRepo.find({ where: { activity_id: activityId }, relations: ['answers', 'student'] });
    const anonymous = !!activity.config?.anonymous;

    return {
      total_responses: responses.length,
      anonymous,
      questions: questions.map((q) => {
        const entries = responses.flatMap((r) =>
          r.answers.filter((a) => a.question_id === q.id).map((a) => ({ answer: a, student: r.student })),
        );

        if (q.type === 'SINGLE_CHOICE' || q.type === 'MULTIPLE_CHOICE') {
          const counts = new Map<string, number>(q.options.map((o) => [o.id, 0]));
          for (const { answer } of entries) {
            for (const optId of answer.selected_option_ids ?? []) {
              if (counts.has(optId)) counts.set(optId, (counts.get(optId) ?? 0) + 1);
            }
          }
          return {
            question_id: q.id,
            text: q.text,
            type: q.type,
            options: q.options.map((o) => ({ id: o.id, text: o.text, count: counts.get(o.id) ?? 0 })),
          };
        }

        if (q.type === 'SCALE') {
          const values = entries.map(({ answer }) => answer.scale_value).filter((v): v is number => v != null);
          const average = values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
          return { question_id: q.id, text: q.text, type: q.type, scale_min: q.scale_min, scale_max: q.scale_max, average, count: values.length };
        }

        return {
          question_id: q.id,
          text: q.text,
          type: q.type,
          answers: entries
            .filter(({ answer }) => !!answer.text_answer)
            .map(({ answer, student: respondent }) => ({
              text: answer.text_answer,
              student: anonymous ? undefined : respondent ? { first_name: respondent.first_name, last_name: respondent.last_name } : undefined,
            })),
        };
      }),
    };
  }
}
