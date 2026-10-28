import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, UseInterceptors, UploadedFile, Req, ForbiddenException, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PlaygroundTemplateService } from './playground-template.service';
import { Request } from 'express';

const ALLOWED_ROLES = ['admin', 'teacher'];

@Controller('playground/admin/templates')
@UseGuards(JwtAuthGuard)
export class PlaygroundTemplateController {
  constructor(private templateService: PlaygroundTemplateService) {}

  private assertAllowed(req: Request) {
    const user = req.user as any;
    if (!ALLOWED_ROLES.includes(user.role?.name?.toLowerCase())) {
      throw new ForbiddenException('Solo administradores o profesores pueden gestionar plantillas.');
    }
  }

  @Get()
  async list(@Req() req: Request, @Query('language') language?: string) {
    this.assertAllowed(req);
    return { data: await this.templateService.list(language) };
  }

  @Get(':id')
  async get(@Req() req: Request, @Param('id') id: string) {
    this.assertAllowed(req);
    return this.templateService.get(id);
  }

  @Post()
  async create(@Req() req: Request, @Body() body: any) {
    this.assertAllowed(req);
    const user = req.user as any;
    return this.templateService.create(user.id, {
      name: body.name,
      description: body.description,
      language: body.language,
      files: body.files ?? [],
    });
  }

  @Patch(':id')
  async update(@Req() req: Request, @Param('id') id: string, @Body() body: any) {
    this.assertAllowed(req);
    return this.templateService.update(id, {
      name: body.name,
      description: body.description,
      language: body.language,
      files: body.files,
    });
  }

  @Delete(':id')
  async remove(@Req() req: Request, @Param('id') id: string) {
    this.assertAllowed(req);
    return this.templateService.remove(id);
  }

  @Post(':id/statement-pdf')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: join(process.cwd(), 'uploads', 'playground-statements'),
      filename: (_, file, cb) => cb(null, `${uuidv4()}${extname(file.originalname)}`),
    }),
    fileFilter: (_, file, cb) => {
      if (!/pdf/.test(file.mimetype)) {
        return cb(new BadRequestException('Solo se permiten archivos PDF') as any, false);
      }
      cb(null, true);
    },
    limits: { fileSize: 20 * 1024 * 1024 },
  }))
  async uploadStatementPdf(@Req() req: Request, @Param('id') id: string, @UploadedFile() file: Express.Multer.File) {
    this.assertAllowed(req);
    if (!file) throw new BadRequestException('No se recibió ningún archivo');
    return this.templateService.setStatementPdf(id, file);
  }

  @Delete(':id/statement-pdf')
  async removeStatementPdf(@Req() req: Request, @Param('id') id: string) {
    this.assertAllowed(req);
    return this.templateService.clearStatementPdf(id);
  }
}
