import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { LmsActivity } from '../../entities/lms-activity.entity';
import { LmsQuizQuestion } from '../../entities/lms-quiz-question.entity';
import { LmsQuizOption } from '../../entities/lms-quiz-option.entity';
import { LmsQuizAttempt } from '../../entities/lms-quiz-attempt.entity';
import { LmsQuizAnswer } from '../../entities/lms-quiz-answer.entity';
import { User } from '../../entities/user.entity';
import { CreateQuizFromFileDto, ImportQuizQuestionsDto, SubmitQuizAttemptDto, UpsertQuizQuestionDto } from './dto/lms.dto';
import { LmsCoursesService } from './lms-courses.service';
import { LmsActivitiesService } from './lms-activities.service';
import { ParsedQuizQuestion, QuizFileFormat, QuizFormatResult, validateParsedQuestions } from './quiz-question-format.types';
import { parseQuizMarkdown, serializeQuizMarkdown } from './quiz-format-markdown';
import { parseGift, serializeGift } from './quiz-format-gift';
import { parseAiken, serializeAiken } from './quiz-format-aiken';
import { parseMoodleXml, serializeMoodleXml } from './quiz-format-moodle-xml';

const EXPORT_META: Record<QuizFileFormat, { ext: string; mime: string }> = {
  own: { ext: 'md', mime: 'text/markdown' },
  gift: { ext: 'txt', mime: 'text/plain' },
  aiken: { ext: 'txt', mime: 'text/plain' },
  moodle_xml: { ext: 'xml', mime: 'application/xml' },
};

/** Banco de preguntas y resolución de quizzes y exámenes autoevaluables (activity.type 'quiz' o 'exam' con config.mode='quiz'). */
@Injectable()
export class LmsQuizzesService {
  constructor(
    @InjectRepository(LmsActivity) private readonly activitiesRepo: Repository<LmsActivity>,
    @InjectRepository(LmsQuizQuestion) private readonly questionsRepo: Repository<LmsQuizQuestion>,
    @InjectRepository(LmsQuizOption) private readonly optionsRepo: Repository<LmsQuizOption>,
    @InjectRepository(LmsQuizAttempt) private readonly attemptsRepo: Repository<LmsQuizAttempt>,
    @InjectRepository(LmsQuizAnswer) private readonly answersRepo: Repository<LmsQuizAnswer>,
    private readonly coursesService: LmsCoursesService,
    private readonly activitiesService: LmsActivitiesService,
  ) {}

  private async activityOrFail(id: string) {
    const activity = await this.activitiesRepo.findOne({ where: { id, type: In(['quiz', 'exam']) }, relations: ['unit'] });
    if (!activity) throw new NotFoundException('Actividad no encontrada');
    return activity;
  }

  private async parseFormat(format: QuizFileFormat, content: string): Promise<QuizFormatResult> {
    switch (format) {
      case 'own':
        return parseQuizMarkdown(content);
      case 'gift':
        return parseGift(content);
      case 'aiken':
        return parseAiken(content);
      case 'moodle_xml':
        return parseMoodleXml(content);
    }
  }

  private serializeFormat(format: QuizFileFormat, questions: ParsedQuizQuestion[]): { content: string; warnings: string[] } {
    switch (format) {
      case 'own':
        return serializeQuizMarkdown(questions);
      case 'gift':
        return serializeGift(questions);
      case 'aiken':
        return serializeAiken(questions);
      case 'moodle_xml':
        return serializeMoodleXml(questions);
    }
  }

  /** Crea las preguntas+opciones de `questions` para `activityId`, con `order` consecutivo desde `startOrder`. */
  private async persistQuestions(activityId: string, questions: ParsedQuizQuestion[], startOrder: number) {
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const question = await this.questionsRepo.save(
        this.questionsRepo.create({
          activity_id: activityId,
          text: q.text,
          type: q.type as any,
          order: startOrder + i,
          feedback: q.feedback ?? null,
        }),
      );
      if (q.options.length) {
        await this.optionsRepo.save(
          q.options.map((o, idx) =>
            this.optionsRepo.create({ question_id: question.id, text: o.text, is_correct: o.is_correct, order: idx + 1 }),
          ),
        );
      }
    }
  }

  async upsertQuestion(dto: UpsertQuizQuestionDto, user: User) {
    const activity = await this.activityOrFail(dto.activity);
    await this.coursesService.getForManage(activity.unit.course_id, user);

    const type = (dto.type as ParsedQuizQuestion['type']) || 'MULTIPLE_CHOICE';
    validateParsedQuestions([
      {
        text: dto.text,
        type,
        options: (dto.options ?? []).map((o) => ({ text: o.text, is_correct: !!o.is_correct })),
      },
    ]);

    const question = await this.questionsRepo.save(
      this.questionsRepo.create({
        activity_id: dto.activity,
        text: dto.text,
        type: type as any,
        order: dto.order ?? 1,
        feedback: dto.feedback ?? null,
      }),
    );

    if (dto.options?.length) {
      const options = dto.options.map((o, idx) =>
        this.optionsRepo.create({
          question_id: question.id,
          text: o.text,
          is_correct: !!o.is_correct,
          order: o.order ?? idx + 1,
        }),
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

  async listQuestionsForManage(activityId: string, user: User) {
    const activity = await this.activityOrFail(activityId);
    await this.coursesService.getForManage(activity.unit.course_id, user);
    return this.questionsRepo.find({ where: { activity_id: activityId }, relations: ['options'], order: { order: 'ASC' } });
  }

  /** Importa preguntas desde un archivo (GIFT/Aiken/Moodle XML/propio) a una actividad ya creada; agrega o reemplaza según `dto.mode`. */
  async importQuestions(activityId: string, dto: ImportQuizQuestionsDto, user: User) {
    const activity = await this.activityOrFail(activityId);
    await this.coursesService.getForManage(activity.unit.course_id, user);

    const { questions, warnings } = await this.parseFormat(dto.format, dto.content);
    validateParsedQuestions(questions);

    let startOrder = 1;
    if (dto.mode === 'replace') {
      await this.questionsRepo.delete({ activity_id: activityId });
    } else {
      const [last] = await this.questionsRepo.find({ where: { activity_id: activityId }, order: { order: 'DESC' }, take: 1 });
      startOrder = (last?.order ?? 0) + 1;
    }
    await this.persistQuestions(activityId, questions, startOrder);

    const created = await this.questionsRepo.find({ where: { activity_id: activityId }, relations: ['options'], order: { order: 'ASC' } });
    return { created, warnings };
  }

  /** Exporta el banco de preguntas de una actividad al formato pedido. */
  async exportQuestions(activityId: string, format: QuizFileFormat, user: User) {
    const activity = await this.activityOrFail(activityId);
    await this.coursesService.getForManage(activity.unit.course_id, user);

    const questions = await this.questionsRepo.find({ where: { activity_id: activityId }, relations: ['options'], order: { order: 'ASC' } });
    const parsed: ParsedQuizQuestion[] = questions.map((q) => ({
      text: q.text,
      type: q.type as ParsedQuizQuestion['type'],
      feedback: q.feedback,
      options: (q.options || []).map((o) => ({ text: o.text, is_correct: o.is_correct })),
    }));
    const { content, warnings } = this.serializeFormat(format, parsed);
    const meta = EXPORT_META[format];
    return {
      filename: `${activity.title.replace(/[^a-zA-Z0-9_\-]+/g, '_') || 'cuestionario'}.${meta.ext}`,
      mimeType: meta.mime,
      content,
      warnings,
    };
  }

  /** Crea una actividad de quiz nueva (DRAFT) y su banco de preguntas en un solo paso, a partir de un archivo. */
  async createFromFile(unitId: string, dto: CreateQuizFromFileDto, user: User) {
    const { questions, warnings } = await this.parseFormat(dto.format, dto.content);
    validateParsedQuestions(questions);

    const activity = await this.activitiesService.create(
      { unit: unitId, type: 'quiz', title: dto.title?.trim() || 'Cuestionario importado', status: 'DRAFT' },
      user,
    );

    try {
      await this.persistQuestions(activity.id, questions, 1);
    } catch (err) {
      await this.activitiesRepo.delete(activity.id); // cascada: limpia también las preguntas ya creadas
      throw err;
    }

    const created = await this.questionsRepo.find({ where: { activity_id: activity.id }, relations: ['options'], order: { order: 'ASC' } });
    return { activity: { ...activity, questions: created }, warnings };
  }

  async listQuestionsForStudent(activityId: string, student: User) {
    const activity = await this.activityOrFail(activityId);
    if (activity.status !== 'PUBLISHED') throw new NotFoundException('Actividad no encontrada');
    await this.coursesService.assertEnrolled(activity.unit.course_id, student);
    const questions = await this.questionsRepo.find({
      where: { activity_id: activityId },
      relations: ['options'],
      order: { order: 'ASC' },
    });
    // No se expone is_correct ni feedback hasta que el alumno entregue el intento.
    return questions.map((q) => ({
      id: q.id,
      text: q.text,
      type: q.type,
      order: q.order,
      options: (q.options || []).map((o) => ({ id: o.id, text: o.text, order: o.order })),
    }));
  }

  async submitAttempt(activityId: string, dto: SubmitQuizAttemptDto, student: User) {
    const activity = await this.activityOrFail(activityId);
    if (activity.status !== 'PUBLISHED') throw new NotFoundException('Actividad no encontrada');
    await this.coursesService.assertEnrolled(activity.unit.course_id, student);

    const questions = await this.questionsRepo.find({ where: { activity_id: activityId }, relations: ['options'] });
    const questionsById = new Map(questions.map((q) => [q.id, q]));

    const attempt = await this.attemptsRepo.save(
      this.attemptsRepo.create({ activity_id: activityId, student_id: student.id, submitted_at: new Date() }),
    );

    let correct = 0;
    let gradable = 0;
    const answers: LmsQuizAnswer[] = [];
    for (const input of dto.answers) {
      const question = questionsById.get(input.question_id);
      if (!question) continue;
      let isCorrect: boolean | undefined;
      if (question.type === 'MULTIPLE_CHOICE') {
        gradable += 1;
        const selected = question.options?.find((o) => o.id === input.selected_option_id);
        isCorrect = !!selected?.is_correct;
        if (isCorrect) correct += 1;
      } else if (question.type === 'MULTI_ANSWER') {
        gradable += 1;
        const correctIds = new Set((question.options ?? []).filter((o) => o.is_correct).map((o) => o.id));
        const selectedIds = new Set(input.selected_option_ids ?? []);
        isCorrect = correctIds.size === selectedIds.size && [...correctIds].every((id) => selectedIds.has(id));
        if (isCorrect) correct += 1;
      }
      answers.push(
        this.answersRepo.create({
          attempt_id: attempt.id,
          question_id: question.id,
          selected_option_id: input.selected_option_id,
          selected_option_ids: input.selected_option_ids,
          text_answer: input.text_answer,
          is_correct: isCorrect,
        }),
      );
    }
    await this.answersRepo.save(answers);

    const score = gradable > 0 ? Math.round((correct / gradable) * (activity.max_score ?? 100)) : null;
    attempt.score = score;
    await this.attemptsRepo.save(attempt);

    await this.activitiesService.markCompleted(activity.id, activity.unit.course_id, student.id, score);
    return this.getAttemptWithFeedback(attempt.id, student);
  }

  async getAttemptWithFeedback(attemptId: string, student: User) {
    const attempt = await this.attemptsRepo.findOne({ where: { id: attemptId, student_id: student.id } });
    if (!attempt) throw new NotFoundException('Intento no encontrado');
    const answers = await this.answersRepo.find({ where: { attempt_id: attemptId }, relations: ['question', 'selected_option'] });
    return {
      ...attempt,
      answers: answers.map((a) => ({
        question_id: a.question_id,
        question_text: a.question.text,
        selected_option_id: a.selected_option_id,
        selected_option_ids: a.selected_option_ids,
        text_answer: a.text_answer,
        is_correct: a.is_correct,
        feedback: a.question.feedback,
      })),
    };
  }

  async myAttempts(activityId: string, student: User) {
    const activity = await this.activityOrFail(activityId);
    await this.coursesService.assertEnrolled(activity.unit.course_id, student);
    return this.attemptsRepo.find({ where: { activity_id: activityId, student_id: student.id }, order: { created_at: 'DESC' } });
  }
}
