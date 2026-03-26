import { Body, Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
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
