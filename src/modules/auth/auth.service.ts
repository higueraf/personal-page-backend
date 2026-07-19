import { BadRequestException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import bcrypt from 'bcrypt';
import { User, UserStatus } from '../../entities/user.entity';
import { Role } from '../../entities/role.entity';
import { RegisterDto } from './dto/register.dto';
import { MailService } from '../mail/mail.service';

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
    private readonly mailService: MailService,
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

  async updateProfile(userId: string, data: { first_name?: string; last_name?: string }) {
    await this.usersRepo.update(userId, data);
    const user = await this.usersRepo.findOne({ where: { id: userId }, relations: ['role'] });
    return this.publicUser(user!);
  }

  async updateAvatar(userId: string, avatarPath: string) {
    await this.usersRepo.update(userId, { avatar: avatarPath });
    const user = await this.usersRepo.findOne({ where: { id: userId }, relations: ['role'] });
    return this.publicUser(user!);
  }

  // ── Recuperación de contraseña ──────────────────────────────────────────────

  /**
   * Genera un token de restablecimiento y envía el correo al usuario.
   * Respuesta genérica para no revelar si el email existe en el sistema.
   */
  async requestPasswordReset(email: string): Promise<void> {
    const user = await this.usersRepo.findOne({ where: { email } });
    if (!user) return; // No revelar si el email existe

    const token = randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

    await this.usersRepo.update(user.id, {
      reset_token: token,
      reset_token_expires: expires,
    });

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const resetLink = `${frontendUrl}/reset-password?token=${token}`;

    try {
      await this.mailService.send({
        to: user.email,
        subject: 'Restablecer contraseña — Plataforma Educativa',
        html: `
          <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#f8f9fc;border-radius:12px;">
            <h2 style="margin:0 0 8px;font-size:1.4rem;color:#111;">Hola, ${user.first_name} 👋</h2>
            <p style="color:#555;line-height:1.6;margin:0 0 24px;">
              Recibimos una solicitud para restablecer la contraseña de tu cuenta.<br>
              Haz clic en el botón de abajo para crear una nueva contraseña.
            </p>
            <a href="${resetLink}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:.95rem;">
              Restablecer contraseña
            </a>
            <p style="color:#888;font-size:.82rem;margin:24px 0 0;line-height:1.5;">
              Este enlace es válido por <strong>1 hora</strong>.<br>
              Si no solicitaste este cambio, puedes ignorar este correo con seguridad.
            </p>
            <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0 16px;">
            <p style="color:#aaa;font-size:.78rem;margin:0;">Plataforma Educativa · No respondas a este correo</p>
          </div>
        `,
      });
    } catch {
      // No se relanza: el token ya quedó guardado y la respuesta debe seguir siendo genérica
      // para no revelar por código de estado si el correo existe o si el envío falló.
    }
  }

  /**
   * Valida el token, actualiza la contraseña y envía un correo de confirmación.
   */
  async resetPassword(token: string, password: string, passwordConfirm: string): Promise<void> {
    if (password !== passwordConfirm) {
      throw new BadRequestException('Las contraseñas no coinciden');
    }

    const user = await this.usersRepo.findOne({ where: { reset_token: token } });

    if (!user || !user.reset_token_expires || user.reset_token_expires < new Date()) {
      throw new BadRequestException('El enlace de restablecimiento es inválido o ha expirado');
    }

    const password_hash = await bcrypt.hash(password, 10);

    await this.usersRepo.update(user.id, {
      password_hash,
      reset_token: undefined,
      reset_token_expires: undefined,
    });

    try {
      await this.mailService.send({
        to: user.email,
        subject: 'Tu contraseña fue cambiada — Plataforma Educativa',
        html: `
          <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#f8f9fc;border-radius:12px;">
            <h2 style="margin:0 0 8px;font-size:1.4rem;color:#111;">Contraseña actualizada ✅</h2>
            <p style="color:#555;line-height:1.6;margin:0 0 16px;">
              Hola, <strong>${user.first_name}</strong>. Tu contraseña fue cambiada exitosamente.
            </p>
            <p style="color:#555;line-height:1.6;margin:0 0 24px;">
              Si no realizaste este cambio, comunícate de inmediato con el administrador o restablece tu contraseña nuevamente.
            </p>
            <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0 16px;">
            <p style="color:#aaa;font-size:.78rem;margin:0;">Plataforma Educativa · No respondas a este correo</p>
          </div>
        `,
      });
    } catch {
      // No se relanza: la contraseña ya fue actualizada exitosamente;
      // un fallo en el correo de confirmación no debe hacer fallar la operación.
    }
  }
}
