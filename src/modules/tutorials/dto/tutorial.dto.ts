import { IsArray, IsBoolean, IsInt, IsObject, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class UpsertCourseDto {
  @IsString() title: string;
  @IsOptional() @IsString() slug?: string;
  @IsOptional() @IsString() description?: string | null;
  @IsOptional() @IsString() level?: string | null;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsBoolean() is_public?: boolean;
  @IsOptional() @IsArray() @IsString({ each: true }) study_courses?: string[];
}

export class UpsertSectionDto {
  @IsString() course: string;
  @IsString() title: string;
  @IsOptional() @IsInt() @Min(1) order?: number;
  @IsOptional() @IsString() status?: string;
}

export class UpsertLessonDto {
  @IsString() section: string;
  @IsString() title: string;
  @IsOptional() @IsString() slug?: string;
  @IsOptional() @IsString() summary?: string | null;
  @IsOptional() @IsInt() @Min(1) order?: number;
  @IsOptional() @IsString() status?: string;
}

export class UpsertPageDto {
  @IsString() lesson: string;
  @IsOptional() @IsString() title?: string | null;
  @IsOptional() @IsInt() @Min(1) order?: number;
  @IsOptional() @IsInt() @Min(0) estimated_minutes?: number;
  @IsOptional() @IsString() status?: string;
}

export class UpsertBlockDto {
  @IsString() page: string;
  @IsString() type: string;
  @IsOptional() @IsInt() @Min(1) order?: number;
  @IsOptional() @IsObject() data?: Record<string, any>;
}

export class ReorderItemDto {
  @IsString() id: string;
  @IsInt() @Min(1) order: number;
}

export class ReorderLessonsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReorderItemDto)
  items: ReorderItemDto[];
}
