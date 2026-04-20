import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { PlaygroundProject } from '../../entities/playground-project.entity';
import { PlaygroundFile } from '../../entities/playground-file.entity';
import { User } from '../../entities/user.entity';

import { PlaygroundService } from './playground.service';
import { ExecutionService } from './execution.service';
import { ExecutionGateway } from './execution.gateway';
import { PlaygroundController } from './playground.controller';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([PlaygroundProject, PlaygroundFile, User]),
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
  controllers: [PlaygroundController],
  providers: [PlaygroundService, ExecutionService, ExecutionGateway],
  exports: [PlaygroundService, ExecutionService],
})
export class PlaygroundModule {}
