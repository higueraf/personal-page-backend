import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

// ── Curso / unidades ─────────────────────────────────────────────────────────

export class UpsertLmsCourseDto {
  @IsString() title: string;
  @IsOptional() @IsString() slug?: string;
  @IsOptional() @IsString() description?: string | null;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() cover_image?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) study_courses?: string[];
}

export class UpsertLmsUnitDto {
  @IsString() course: string;
  @IsString() title: string;
  @IsOptional() @IsInt() @Min(1) order?: number;
  @IsOptional() @IsString() status?: string;
}

// ── Actividades ──────────────────────────────────────────────────────────────

export class UpsertLmsActivityDto {
  @IsString() unit: string;
  @IsString() type: string;
  @IsString() title: string;
  @IsOptional() @IsString() instructions?: string | null;
  @IsOptional() @IsInt() @Min(1) order?: number;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsDateString() due_at?: string | null;
  @IsOptional() @IsNumber() max_score?: number | null;
  @IsOptional() @IsObject() config?: Record<string, any>;
}

// ── Foro ─────────────────────────────────────────────────────────────────────

export class CreateForumThreadDto {
  @IsString() activity: string;
  @IsString() title: string;
  @IsString() body: string;
}

export class CreateForumPostDto {
  @IsString() thread: string;
  @IsString() body: string;
  @IsOptional() @IsString() parent_post?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) mentioned_user_ids?: string[];
}

// ── Tareas / entregas ────────────────────────────────────────────────────────

export class SubmitAssignmentDto {
  @IsOptional() @IsString() content_text?: string;
  @IsOptional() @IsString() file_url?: string;
}

export class GradeSubmissionDto {
  @IsNumber() grade: number;
  @IsOptional() @IsString() feedback?: string;
}

// ── Quizzes / exámenes ───────────────────────────────────────────────────────

export class UpsertQuizOptionDto {
  @IsString() text: string;
  @IsOptional() @IsBoolean() is_correct?: boolean;
  @IsOptional() @IsInt() @Min(1) order?: number;
}

export class UpsertQuizQuestionDto {
  @IsString() activity: string;
  @IsString() text: string;
  @IsOptional() @IsIn(['MULTIPLE_CHOICE', 'OPEN']) type?: string;
  @IsOptional() @IsInt() @Min(1) order?: number;
  @IsOptional() @IsString() feedback?: string | null;
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpsertQuizOptionDto)
  options?: UpsertQuizOptionDto[];
}

export class QuizAnswerInputDto {
  @IsString() question_id: string;
  @IsOptional() @IsString() selected_option_id?: string;
  @IsOptional() @IsString() text_answer?: string;
}

export class SubmitQuizAttemptDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuizAnswerInputDto)
  answers: QuizAnswerInputDto[];
}
