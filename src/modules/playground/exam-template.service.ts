import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ExamTemplate } from '../../entities/exam-template.entity';
import { ExamVersion, ExamQuestion } from '../../entities/exam-version.entity';

interface SaveVersionDto {
  theme_name: string;
  order_index: number;
  questions: ExamQuestion[];
}

interface SaveExamTemplateDto {
  name: string;
  description?: string;
  language: string;
  versions: SaveVersionDto[];
}

@Injectable()
export class ExamTemplateService {
  constructor(
    @InjectRepository(ExamTemplate)
    private templateRepo: Repository<ExamTemplate>,
    @InjectRepository(ExamVersion)
    private versionRepo: Repository<ExamVersion>,
  ) {}

  async list() {
    const templates = await this.templateRepo.find({
      relations: ['versions'],
      order: { created_at: 'DESC' },
    });
    // Order versions client-side (TypeORM doesn't support order on nested relations easily here)
    for (const t of templates) {
      t.versions = (t.versions ?? []).sort((a, b) => a.order_index - b.order_index);
    }
    return templates;
  }

  async get(id: string) {
    const template = await this.templateRepo.findOne({ where: { id }, relations: ['versions'] });
    if (!template) throw new NotFoundException('Examen no encontrado');
    template.versions = (template.versions ?? []).sort((a, b) => a.order_index - b.order_index);
    return template;
  }

  async create(userId: string, dto: SaveExamTemplateDto) {
    const template = this.templateRepo.create({
      name: dto.name,
      description: dto.description,
      language: dto.language ?? 'typescript',
      created_by: userId,
    });
    const saved = await this.templateRepo.save(template);

    const versions = (dto.versions ?? []).map((v) =>
      this.versionRepo.create({
        exam_template_id: saved.id,
        theme_name: v.theme_name,
        order_index: v.order_index,
        questions: v.questions ?? [],
      }),
    );
    if (versions.length) await this.versionRepo.save(versions);

    return this.get(saved.id);
  }

  async update(id: string, dto: Partial<SaveExamTemplateDto>) {
    await this.get(id);
    await this.templateRepo.update(id, {
      ...(dto.name !== undefined ? { name: dto.name } : {}),
      ...(dto.description !== undefined ? { description: dto.description } : {}),
      ...(dto.language !== undefined ? { language: dto.language } : {}),
    });

    if (dto.versions !== undefined) {
      // Full replace: simplest strategy, consistent with how PlaygroundTemplate.files is replaced wholesale.
      await this.versionRepo.delete({ exam_template_id: id });
      const versions = dto.versions.map((v) =>
        this.versionRepo.create({
          exam_template_id: id,
          theme_name: v.theme_name,
          order_index: v.order_index,
          questions: v.questions ?? [],
        }),
      );
      if (versions.length) await this.versionRepo.save(versions);
    }

    return this.get(id);
  }

  async remove(id: string) {
    await this.get(id);
    await this.templateRepo.delete(id);
    return { success: true };
  }
}
