import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { PlaygroundProject } from '../../entities/playground-project.entity';
import { PlaygroundFile } from '../../entities/playground-file.entity';
import { PlaygroundTemplate } from '../../entities/playground-template.entity';
import { ExamTemplate } from '../../entities/exam-template.entity';
import { ExamVersion } from '../../entities/exam-version.entity';
import { User } from '../../entities/user.entity';

import { PlaygroundService } from './playground.service';
import { PlaygroundTemplateService } from './playground-template.service';
import { ExamTemplateService } from './exam-template.service';
import { ExecutionService } from './execution.service';
import { ExecutionGateway } from './execution.gateway';
import { PlaygroundController } from './playground.controller';
import { PlaygroundTemplateController } from './playground-template.controller';
import { ExamTemplateController } from './exam-template.controller';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([PlaygroundProject, PlaygroundFile, PlaygroundTemplate, ExamTemplate, ExamVersion, User]),
    MailModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') || 'change-this-secret',
        signOptions: {
          expiresIn: (configService.get<string>('JWT_EXPIRES_IN') || '7d') as any,
        },
      }),
    }),
  ],
  controllers: [PlaygroundController, PlaygroundTemplateController, ExamTemplateController],
  providers: [PlaygroundService, PlaygroundTemplateService, ExamTemplateService, ExecutionService, ExecutionGateway],
  exports: [PlaygroundService, ExecutionService],
})
export class PlaygroundModule {}
