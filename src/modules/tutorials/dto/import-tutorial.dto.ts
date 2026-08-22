import { IsArray, IsInt, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { UpsertCourseDto } from './tutorial.dto';

export class ImportLessonDto {
  @IsString() slug: string;
  @IsString() title: string;
  @IsInt() @Min(1) order: number;
  @IsString() markdown: string;
}

export class ImportSectionDto {
  @IsString() title: string;
  @IsInt() @Min(0) order: number; // 0 = sección "Contenido" (fallback sin módulo detectado)

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportLessonDto)
  lessons: ImportLessonDto[];
}

export class ImportTutorialDto {
  @IsOptional() @IsString() courseId?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => UpsertCourseDto)
  course?: UpsertCourseDto;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportSectionDto)
  sections: ImportSectionDto[];
}
