import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { PracticeApiService } from './practice-api.service';

/**
 * API de práctica — recurso CRUD público y aislado, sin relación con las
 * tablas/módulos de negocio del sitio. Se usa para que los alumnos consuman
 * un backend real desde exámenes (ej. Flutter) o cualquier otro frontend.
 * No requiere autenticación (ver CORS abierto para este prefijo en main.ts).
 *
 * El segmento `:variant` (ej. "ropa", "libros", "farmacia", "tareas") separa
 * los datos y define qué campos maneja cada variante — ver
 * `practice-variants.config.ts`. `:resource` es el nombre del recurso en la
 * URL (ej. "prendas", "libros", "medicamentos", "tareas") — distinto por
 * variante para que la ruta completa nunca sea la genérica "items"; solo se
 * usa para armar la URL, la lógica sigue indexada por `variant`.
 */
@Controller('practice-api/:variant/:resource')
export class PracticeApiController {
  constructor(private readonly service: PracticeApiService) {}

  @Get()
  list(@Param('variant') variant: string) {
    return this.service.list(variant);
  }

  @Get(':id')
  getOne(@Param('variant') variant: string, @Param('id') id: string) {
    return this.service.getOne(variant, id);
  }

  @Post()
  create(@Param('variant') variant: string, @Body() body: any) {
    return this.service.create(variant, body);
  }

  @Post('reset')
  reset(@Param('variant') variant: string) {
    return this.service.reset(variant);
  }

  @Patch(':id')
  update(@Param('variant') variant: string, @Param('id') id: string, @Body() body: any) {
    return this.service.update(variant, id, body);
  }

  @Delete(':id')
  remove(@Param('variant') variant: string, @Param('id') id: string) {
    return this.service.remove(variant, id);
  }
}
