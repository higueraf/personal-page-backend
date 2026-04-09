import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlaygroundProject } from '../../entities/playground-project.entity';
import { PlaygroundFile } from '../../entities/playground-file.entity';
import { PlaygroundService } from './playground.service';
import { ExecutionService } from './execution.service';
import { PlaygroundController } from './playground.controller';

import { User } from '../../entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([PlaygroundProject, PlaygroundFile, User])],
  controllers: [PlaygroundController],
  providers: [PlaygroundService, ExecutionService],
  exports: [PlaygroundService, ExecutionService],
})
export class PlaygroundModule {}
