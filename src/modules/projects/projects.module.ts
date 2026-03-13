import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Project } from '../../entities/project.entity';
import { ProjectsAdminController, ProjectsPublicController } from './projects.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Project])],
  controllers: [ProjectsAdminController, ProjectsPublicController],
})
export class ProjectsModule {}
