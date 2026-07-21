import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PracticeItem } from '../../entities/practice-item.entity';
import { PracticeApiController } from './practice-api.controller';
import { PracticeApiService } from './practice-api.service';

@Module({
  imports: [TypeOrmModule.forFeature([PracticeItem])],
  controllers: [PracticeApiController],
  providers: [PracticeApiService],
})
export class PracticeApiModule {}
