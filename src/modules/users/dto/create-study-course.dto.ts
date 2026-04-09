import { IsString, IsOptional } from 'class-validator';

export class CreateStudyCourseDto {
  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  institution_id?: string;
}
