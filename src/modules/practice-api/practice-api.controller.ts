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
 * `practice-variants.config.ts`. Cada variante tiene así su propio endpoint
 * y sus propios nombres de campo, para que no se pueda reutilizar el mismo
 * proyecto entre variantes distintas sin cambios reales de código.
 */
@Controller('practice-api/:variant/items')
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
