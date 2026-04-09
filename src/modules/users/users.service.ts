import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../entities/user.entity';
import { Role } from '../../entities/role.entity';
import { Institution } from '../../entities/institution.entity';
import { StudyCourse } from '../../entities/study-course.entity';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)         private readonly usersRepo: Repository<User>,
    @InjectRepository(Role)         private readonly rolesRepo: Repository<Role>,
    @InjectRepository(Institution)  private readonly institutionsRepo: Repository<Institution>,
    @InjectRepository(StudyCourse)  private readonly studyCoursesRepo: Repository<StudyCourse>,
  ) {}

  async findAll(page: string, pageSize: string, status?: string, search?: string) {
    const p    = Math.max(1, parseInt(page));
    const size = Math.min(100, parseInt(pageSize));

    const qb = this.usersRepo
      .createQueryBuilder('u')
      .leftJoinAndSelect('u.role', 'role')
      .leftJoinAndSelect('u.institution', 'institution')
      .leftJoinAndSelect('u.study_course', 'study_course')
      .orderBy('u.created_at', 'DESC')
      .skip((p - 1) * size)
      .take(size);

    if (status) qb.andWhere('u.status = :status', { status });
    if (search) {
      qb.andWhere(
        '(u.email ILIKE :q OR u.first_name ILIKE :q OR u.last_name ILIKE :q)',
        { q: `%${search}%` },
      );
    }

    const [users, total] = await qb.getManyAndCount();

    return {
      data: users.map((u) => this.serialize(u)),
      meta: { total_records: total, page: p, page_size: size },
    };
  }

  async findRoles() {
    const roles = await this.rolesRepo.find({ order: { name: 'ASC' } });
    return { data: roles.map((r) => ({ id: r.id, name: r.name })) };
  }

  async updateUser(id: string, dto: UpdateUserDto) {
    const user = await this.usersRepo.findOne({
      where: { id },
      relations: ['role', 'institution', 'study_course'],
    });
    if (!user) return { error: 'Usuario no encontrado' };

    if (dto.status    !== undefined) user.status    = dto.status;
    if (dto.is_active !== undefined) user.is_active = dto.is_active;
    if (dto.user_type !== undefined) user.user_type = dto.user_type;

    if (dto.role_id) {
      const role = await this.rolesRepo.findOne({ where: { id: dto.role_id } });
      if (role) user.role = role;
    }

    // institution_id: null → clear,  string → set,  undefined → keep
    if (dto.institution_id !== undefined) {
      if (dto.institution_id === null || dto.institution_id === '') {
        user.institution_id = null;
        user.institution    = null;
      } else {
        const inst = await this.institutionsRepo.findOne({ where: { id: dto.institution_id } });
        if (inst) { user.institution = inst; user.institution_id = inst.id; }
      }
    }

    // study_course_id: same pattern
    if (dto.study_course_id !== undefined) {
      if (dto.study_course_id === null || dto.study_course_id === '') {
        user.study_course_id = null;
        user.study_course    = null;
      } else {
        const sc = await this.studyCoursesRepo.findOne({ where: { id: dto.study_course_id } });
        if (sc) { user.study_course = sc; user.study_course_id = sc.id; }
      }
    }

    const saved = await this.usersRepo.save(user);

    // Reload relations to serialize correctly
    const reloaded = await this.usersRepo.findOne({
      where: { id: saved.id },
      relations: ['role', 'institution', 'study_course'],
    });
    return { data: this.serialize(reloaded!) };
  }

  private serialize(u: User) {
    return {
      id:          u.id,
      first_name:  u.first_name,
      last_name:   u.last_name,
      email:       u.email,
      status:      u.status,
      is_active:   u.is_active,
      user_type:   u.user_type,
      role:        u.role        ? { id: u.role.id,        name: u.role.name        } : null,
      institution: u.institution ? { id: u.institution.id, name: u.institution.name } : null,
      study_course: u.study_course
        ? { id: u.study_course.id, name: u.study_course.name, institution_id: u.study_course.institution_id }
        : null,
      created_at:  u.created_at,
    };
  }
}
