import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { TodoApiService } from './todo-api.service';

/**
 * API pública de ejemplo ("ToDo") — sirve como referencia funcional completa
 * dentro del examen de Flutter. Sin autenticación, igual que /practice-api.
 */
@Controller('todo-api/todos')
export class TodoApiController {
  constructor(private readonly service: TodoApiService) {}

  @Get()
  list() {
    return this.service.list();
  }

  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.service.getOne(id);
  }

  @Post()
  create(@Body() body: any) {
    return this.service.create(body);
  }

  @Post('reset')
  reset() {
    return this.service.reset();
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: any) {
    return this.service.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
