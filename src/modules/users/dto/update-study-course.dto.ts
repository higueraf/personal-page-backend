import { IsOptional, IsString } from 'class-validator';

export class UpdateStudyCourseDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  institution_id?: string;
}
