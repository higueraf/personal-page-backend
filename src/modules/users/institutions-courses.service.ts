import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Institution } from '../../entities/institution.entity';
import { StudyCourse } from '../../entities/study-course.entity';
import { CreateInstitutionDto } from './dto/create-institution.dto';
import { CreateStudyCourseDto } from './dto/create-study-course.dto';
import { UpdateInstitutionDto } from './dto/update-institution.dto';
import { UpdateStudyCourseDto } from './dto/update-study-course.dto';

@Injectable()
export class InstitutionsCoursesService {
  constructor(
    @InjectRepository(Institution) private readonly institutionsRepo: Repository<Institution>,
    @InjectRepository(StudyCourse) private readonly studyCoursesRepo: Repository<StudyCourse>,
  ) {}

  // ── Instituciones ──────────────────────────────────────────────

  async findAllInstitutions() {
    const items = await this.institutionsRepo.find({ order: { name: 'ASC' } });
    return { data: items };
  }

  async createInstitution(dto: CreateInstitutionDto) {
    const inst = this.institutionsRepo.create({ name: dto.name, description: dto.description });
    const saved = await this.institutionsRepo.save(inst);
    return { data: saved };
  }

  async updateInstitution(id: string, dto: UpdateInstitutionDto) {
    const inst = await this.institutionsRepo.findOne({ where: { id } });
    if (!inst) throw new NotFoundException('Institución no encontrada');
    if (dto.name !== undefined) inst.name = dto.name;
    if (dto.description !== undefined) inst.description = dto.description;
    const saved = await this.institutionsRepo.save(inst);
    return { data: saved };
  }

  async deleteInstitution(id: string) {
    const inst = await this.institutionsRepo.findOne({ where: { id } });
    if (!inst) throw new NotFoundException('Institución no encontrada');
    await this.institutionsRepo.remove(inst);
    return { message: 'Eliminada' };
  }

  // ── Cursos ─────────────────────────────────────────────────────

  async findAllStudyCourses(institution_id?: string) {
    const where: any = {};
    if (institution_id) where.institution_id = institution_id;
    const items = await this.studyCoursesRepo.find({
      where,
      order: { name: 'ASC' },
      relations: ['institution'],
    });
    return { data: items };
  }

  async createStudyCourse(dto: CreateStudyCourseDto) {
    const course = this.studyCoursesRepo.create({
      name: dto.name,
      description: dto.description,
      institution_id: dto.institution_id || undefined,
    });
    const saved = await this.studyCoursesRepo.save(course);
    return { data: saved };
  }

  async updateStudyCourse(id: string, dto: UpdateStudyCourseDto) {
    const course = await this.studyCoursesRepo.findOne({ where: { id } });
    if (!course) throw new NotFoundException('Curso no encontrado');
    if (dto.name !== undefined) course.name = dto.name;
    if (dto.description !== undefined) course.description = dto.description;
    if (dto.institution_id !== undefined) course.institution_id = dto.institution_id || undefined;
    const saved = await this.studyCoursesRepo.save(course);
    return { data: saved };
  }

  async deleteStudyCourse(id: string) {
    const course = await this.studyCoursesRepo.findOne({ where: { id } });
    if (!course) throw new NotFoundException('Curso no encontrado');
    await this.studyCoursesRepo.remove(course);
    return { message: 'Eliminado' };
  }
}
