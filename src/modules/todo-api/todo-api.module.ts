import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TodoItem } from '../../entities/todo-item.entity';
import { TodoApiController } from './todo-api.controller';
import { TodoApiService } from './todo-api.service';

@Module({
  imports: [TypeOrmModule.forFeature([TodoItem])],
  controllers: [TodoApiController],
  providers: [TodoApiService],
})
export class TodoApiModule {}
