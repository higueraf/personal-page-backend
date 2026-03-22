import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlaygroundProject } from '../../entities/playground-project.entity';
import { PlaygroundFile } from '../../entities/playground-file.entity';
import { PlaygroundService } from './playground.service';
import { ExecutionService } from './execution.service';
import { PlaygroundController } from './playground.controller';

@Module({
  imports: [TypeOrmModule.forFeature([PlaygroundProject, PlaygroundFile])],
  controllers: [PlaygroundController],
  providers: [PlaygroundService, ExecutionService],
  exports: [PlaygroundService, ExecutionService],
})
export class PlaygroundModule {}
