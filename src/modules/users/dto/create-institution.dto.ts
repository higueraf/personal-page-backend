import { IsString, IsOptional } from 'class-validator';

export class CreateInstitutionDto {
  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;
}
