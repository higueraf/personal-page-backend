import { IsInt, IsObject, IsOptional, IsString, Min } from 'class-validator';

export class UpsertCourseDto {
  @IsString() title: string;
  @IsOptional() @IsString() slug?: string;
  @IsOptional() @IsString() description?: string | null;
  @IsOptional() @IsString() level?: string | null;
  @IsOptional() @IsString() status?: string;
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
