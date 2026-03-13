import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProfileItem } from '../../entities/profile-item.entity';
import { ProfileAdminController, ProfilePublicController } from './profile.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ProfileItem])],
  controllers: [ProfileAdminController, ProfilePublicController],
})
export class ProfileModule {}
