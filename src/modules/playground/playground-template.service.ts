import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PlaygroundTemplate, PlaygroundTemplateFile } from '../../entities/playground-template.entity';

interface SaveTemplateDto {
  name: string;
  description?: string;
  language: string;
  files: PlaygroundTemplateFile[];
}

@Injectable()
export class PlaygroundTemplateService {
  constructor(
    @InjectRepository(PlaygroundTemplate)
    private templateRepo: Repository<PlaygroundTemplate>,
  ) {}

  async list(language?: string) {
    return this.templateRepo.find({
      where: language ? { language } : {},
      order: { created_at: 'DESC' },
    });
  }

  async get(id: string) {
    const template = await this.templateRepo.findOne({ where: { id } });
    if (!template) throw new NotFoundException('Plantilla no encontrada');
    return template;
  }

  async create(userId: string, dto: SaveTemplateDto) {
    const template = this.templateRepo.create({
      name: dto.name,
      description: dto.description,
      language: dto.language,
      files: dto.files ?? [],
      created_by: userId,
    });
    return this.templateRepo.save(template);
  }

  async update(id: string, dto: Partial<SaveTemplateDto>) {
    await this.get(id);
    await this.templateRepo.update(id, {
      ...(dto.name !== undefined ? { name: dto.name } : {}),
      ...(dto.description !== undefined ? { description: dto.description } : {}),
      ...(dto.language !== undefined ? { language: dto.language } : {}),
      ...(dto.files !== undefined ? { files: dto.files } : {}),
    });
    return this.get(id);
  }

  async remove(id: string) {
    await this.get(id);
    await this.templateRepo.delete(id);
    return { success: true };
  }
}
