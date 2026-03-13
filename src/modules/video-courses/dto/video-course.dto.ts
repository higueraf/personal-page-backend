import { IsBoolean, IsInt, IsObject, IsOptional, IsString, Min } from 'class-validator';

export class UpsertVideoCourseDto {
  @IsString() title: string;
  @IsOptional() @IsString() slug?: string;
  @IsOptional() @IsString() description?: string | null;
  @IsOptional() @IsString() level?: string | null;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() thumbnail?: string | null;
}

export class UpsertVideoSectionDto {
  @IsString() course: string;
  @IsString() title: string;
  @IsOptional() @IsInt() @Min(1) order?: number;
}

export class UpsertVideoLessonDto {
  @IsString() section: string;
  @IsString() title: string;
  @IsOptional() @IsString() slug?: string;
  @IsOptional() @IsInt() @Min(1) order?: number;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() video_type?: string;
  @IsOptional() @IsString() video_url?: string | null;
  @IsOptional() @IsString() video_file?: string | null;
  @IsOptional() @IsInt() @Min(0) duration_seconds?: number;
  @IsOptional() @IsString() markdown?: string;
  @IsOptional() @IsBoolean() is_free_preview?: boolean;
}
