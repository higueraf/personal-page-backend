import { IsArray, IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { UserStatus, UserType } from '../../../entities/user.entity';

export class UpdateUserDto {
  @IsEnum(UserStatus)
  @IsOptional()
  status?: UserStatus;

  @IsString()
  @IsOptional()
  role_id?: string;

  @IsBoolean()
  @IsOptional()
  is_active?: boolean;

  @IsEnum(UserType)
  @IsOptional()
  user_type?: UserType;

  @IsString()
  @IsOptional()
  institution_id?: string | null;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  study_course_ids?: string[];
}
