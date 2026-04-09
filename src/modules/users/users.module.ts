import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../../entities/user.entity';
import { Role } from '../../entities/role.entity';
import { Institution } from '../../entities/institution.entity';
import { StudyCourse } from '../../entities/study-course.entity';
import { UsersAdminController } from './users-admin.controller';
import { InstitutionsCoursesAdminController } from './institutions-courses-admin.controller';
import { UsersService } from './users.service';
import { InstitutionsCoursesService } from './institutions-courses.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, Role, Institution, StudyCourse])],
  controllers: [UsersAdminController, InstitutionsCoursesAdminController],
  providers: [UsersService, InstitutionsCoursesService],
  exports: [UsersService, InstitutionsCoursesService],
})
export class UsersModule {}
