import { BadRequestException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';
import bcrypt from 'bcrypt';
import { User, UserStatus } from '../../entities/user.entity';
import { Role } from '../../entities/role.entity';
import { RegisterDto } from './dto/register.dto';

interface GoogleUserDto {
  email: string;
  firstName: string;
  lastName: string;
  avatar?: string;
  googleId: string;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly usersRepo: Repository<User>,
    @InjectRepository(Role) private readonly rolesRepo: Repository<Role>,
    private readonly jwtService: JwtService,
  ) {}

  async validateUser(email: string, password: string) {
    const user = await this.usersRepo.findOne({
      where: { email },
      relations: ['role'],
    });
    if (!user) throw new UnauthorizedException('Credenciales inválidas');

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) throw new UnauthorizedException('Credenciales inválidas');

    if (user.status === UserStatus.PENDING) {
      throw new ForbiddenException('Tu cuenta está pendiente de aprobación por el administrador.');
    }
    if (user.status === UserStatus.SUSPENDED) {
      throw new ForbiddenException('Tu cuenta ha sido suspendida. Contacta al administrador.');
    }
    if (user.status === UserStatus.REJECTED) {
      throw new ForbiddenException('Tu solicitud de registro fue denegada.');
    }
    if (!user.is_active) {
      throw new ForbiddenException('Tu cuenta está desactivada.');
    }

    return user;
  }

  sign(user: User) {
    return this.jwtService.sign({
      sub: user.id,
      email: user.email,
      role: user.role?.name || null,
    });
  }

  async register(dto: RegisterDto) {
    if (dto.password !== dto.password_confirm) {
      throw new BadRequestException('Las contraseñas no coinciden');
    }
    const exists = await this.usersRepo.findOne({ where: { email: dto.email } });
    if (exists) throw new BadRequestException('El email ya está registrado');

    const studentRole = await this.rolesRepo.findOne({ where: { name: 'student' } });
    if (!studentRole) throw new BadRequestException('Configuración interna inválida');

    const password_hash = await bcrypt.hash(dto.password, 10);
    const user = this.usersRepo.create({
      first_name: dto.first_name,
      last_name: dto.last_name,
      email: dto.email,
      password_hash,
      role: studentRole,
      status: UserStatus.PENDING,
      is_active: true,
    });
    const saved = await this.usersRepo.save(user);
    return this.publicUser(saved);
  }

  async findUserForJwt(id: string) {
    return this.usersRepo.findOne({
      where: { id },
      relations: ['role'],
    });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepo.findOne({
      where: { email },
      relations: ['role'],
    });
  }

  async createGoogleUser(googleUser: GoogleUserDto): Promise<User> {
    const studentRole = await this.rolesRepo.findOne({ where: { name: 'student' } });
    if (!studentRole) throw new BadRequestException('Configuración interna inválida');

    const user = this.usersRepo.create({
      first_name: googleUser.firstName,
      last_name: googleUser.lastName,
      email: googleUser.email,
      google_id: googleUser.googleId,
      avatar: googleUser.avatar,
      role: studentRole,
      status: UserStatus.APPROVED, // Los usuarios de Google se activan automáticamente
      is_active: true,
      password_hash: '', // No tienen contraseña
    });

    return this.usersRepo.save(user);
  }

  async updateGoogleInfo(userId: string, googleInfo: { googleId: string; avatar?: string }): Promise<User> {
    await this.usersRepo.update(userId, {
      google_id: googleInfo.googleId,
      avatar: googleInfo.avatar,
    });

    const user = await this.usersRepo.findOne({
      where: { id: userId },
      relations: ['role'],
    });

    if (!user) {
      throw new BadRequestException('Usuario no encontrado');
    }

    return user;
  }

  publicUser(user: User) {
    return {
      id: user.id,
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.email,
      avatar: user.avatar,
      role: user.role
        ? { name: user.role.name, permissions: user.role.permissions || [] }
        : null,
      permissions: user.role?.permissions || [],
      status: user.status,
      is_active: user.is_active,
    };
  }
}
