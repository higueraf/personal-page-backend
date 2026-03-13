import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) => {
          const cookieName = configService.get<string>('COOKIE_NAME') || 'jwt';
          if (req && req.cookies && req.cookies[cookieName]) {
            return req.cookies[cookieName];
          }
          if (req && req.headers && req.headers.cookie) {
            const cookies = req.headers.cookie.split(';');
            for (const cookie of cookies) {
              const [name, value] = cookie.trim().split('=');
              if (name === cookieName) {
                return value;
              }
            }
          }
          return null;
        },
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') || 'change-this-secret',
    });
  }

  async validate(payload: any) {
    const user = await this.authService.findUserForJwt(payload.sub);
    if (!user) {
      throw new Error('Usuario no encontrado');
    }
    return user;
  }
}
