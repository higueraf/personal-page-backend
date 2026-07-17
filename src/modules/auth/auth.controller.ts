import { Body, Controller, Get, Post, Patch, Req, Res, UseGuards, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { GoogleAuthGuard } from './google-auth.guard';

@Controller()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('auth/login')
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const user = await this.authService.validateUser(dto.email, dto.password);
    const jwt = this.authService.sign(user);
    res.cookie(process.env.COOKIE_NAME || 'jwt', jwt, {
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      path: '/',
    });
    return { jwt };
  }

  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return { data: await this.authService.register(dto) };
  }

  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(process.env.COOKIE_NAME || 'jwt', { path: '/' });
    return { ok: true };
  }

  @UseGuards(JwtAuthGuard)
  @Get('user')
  me(@Req() req: Request & { user: any }) {
    return { data: this.authService.publicUser(req.user) };
  }

  @UseGuards(JwtAuthGuard)
  @Patch('user')
  async updateProfile(
    @Req() req: Request & { user: any },
    @Body() body: { first_name?: string; last_name?: string },
  ) {
    return { data: await this.authService.updateProfile(req.user.id, body) };
  }

  @UseGuards(JwtAuthGuard)
  @Post('user/avatar')
  @UseInterceptors(FileInterceptor('avatar', {
    storage: diskStorage({
      destination: join(process.cwd(), 'uploads', 'avatars'),
      filename: (_, file, cb) => cb(null, `${uuidv4()}${extname(file.originalname)}`),
    }),
    fileFilter: (_, file, cb) => {
      if (!file.mimetype.match(/^image\//)) {
        return cb(new BadRequestException('Solo se permiten imágenes') as any, false);
      }
      cb(null, true);
    },
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  }))
  async uploadAvatar(
    @Req() req: Request & { user: any },
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('No se recibió ningún archivo');
    const avatarPath = `/uploads/avatars/${file.filename}`;
    return { data: await this.authService.updateAvatar(req.user.id, avatarPath) };
  }

  @Post('auth/forgot-password')
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.authService.requestPasswordReset(dto.email);
    // Siempre responder con el mismo mensaje para no revelar si el email existe
    return { message: 'Si tu correo está registrado, recibirás un enlace para restablecer tu contraseña.' };
  }

  @Post('auth/reset-password')
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.authService.resetPassword(dto.token, dto.password, dto.password_confirm);
    return { message: 'Contraseña actualizada exitosamente.' };
  }

  // Rutas de Google OAuth
  @Get('auth/google')
  @UseGuards(GoogleAuthGuard)
  async googleAuth() {
    // Inicia el flujo de OAuth con Google
  }

  @Get('auth/google/callback')
  @UseGuards(GoogleAuthGuard)
  async googleAuthCallback(@Req() req: Request & { user: any }, @Res({ passthrough: true }) res: Response) {
    const user = req.user;
    const jwt = this.authService.sign(user);

    // Establecer la cookie JWT
    res.cookie(process.env.COOKIE_NAME || 'jwt', jwt, {
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      path: '/',
    });

    // Redirigir al frontend
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/admin`);
  }
}
