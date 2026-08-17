import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { LmsActivity } from '../../entities/lms-activity.entity';
import { LmsQuizQuestion } from '../../entities/lms-quiz-question.entity';
import { LmsQuizOption } from '../../entities/lms-quiz-option.entity';
import { LmsQuizAttempt } from '../../entities/lms-quiz-attempt.entity';
import { LmsQuizAnswer } from '../../entities/lms-quiz-answer.entity';
import { User } from '../../entities/user.entity';
import { SubmitQuizAttemptDto, UpsertQuizQuestionDto } from './dto/lms.dto';
import { LmsCoursesService } from './lms-courses.service';
import { LmsActivitiesService } from './lms-activities.service';

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

  async upsertQuestion(dto: UpsertQuizQuestionDto, user: User) {
    const activity = await this.activityOrFail(dto.activity);
    await this.coursesService.getForManage(activity.unit.course_id, user);

    const question = await this.questionsRepo.save(
      this.questionsRepo.create({
        activity_id: dto.activity,
        text: dto.text,
        type: (dto.type as any) || 'MULTIPLE_CHOICE',
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
      }
      answers.push(
        this.answersRepo.create({
          attempt_id: attempt.id,
          question_id: question.id,
          selected_option_id: input.selected_option_id,
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
