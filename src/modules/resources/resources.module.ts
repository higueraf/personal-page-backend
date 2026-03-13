import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Resource } from '../../entities/resource.entity';
import { ResourcesAdminController, ResourcesPublicController } from './resources.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Resource])],
  controllers: [ResourcesAdminController, ResourcesPublicController],
})
export class ResourcesModule {}
