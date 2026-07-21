import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { PracticeApiService } from './practice-api.service';

/**
 * API de práctica — recurso CRUD público y aislado, sin relación con las
 * tablas/módulos de negocio del sitio. Se usa para que los alumnos consuman
 * un backend real desde exámenes (ej. Flutter) o cualquier otro frontend.
 * No requiere autenticación (ver CORS abierto para este prefijo en main.ts).
 */
@Controller('practice-api/items')
export class PracticeApiController {
  constructor(private readonly service: PracticeApiService) {}

  @Get()
  list(@Query('type') type: string) {
    if (!type) throw new NotFoundException('El parámetro "type" es requerido');
    return this.service.list(type);
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
  reset(@Body('type') type: string) {
    return this.service.reset(type);
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
