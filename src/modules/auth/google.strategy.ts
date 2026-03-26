import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile } from 'passport-google-oauth20';
import { AuthService } from './auth.service';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(private authService: AuthService) {
    super({
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/auth/google/callback',
      scope: ['email', 'profile'],
    });
  }

  async validate(accessToken: string, refreshToken: string, profile: Profile, done: any) {
    try {
      // Extraer información del perfil de Google
      const { id, emails, name, photos } = profile;
      const email = emails?.[0]?.value;
      
      if (!email) {
        return done(new Error('No email found in Google profile'), null);
      }

      // Buscar o crear usuario
      let user = await this.authService.findByEmail(email);
      
      if (!user) {
        // Crear nuevo usuario si no existe
        user = await this.authService.createGoogleUser({
          email,
          firstName: name?.givenName || '',
          lastName: name?.familyName || '',
          avatar: photos?.[0]?.value,
          googleId: id,
        });
      } else {
        // Actualizar información de Google si el usuario ya existe
        user = await this.authService.updateGoogleInfo(user.id, {
          googleId: id,
          avatar: photos?.[0]?.value,
        });
      }

      return done(null, user);
    } catch (error) {
      return done(error, null);
    }
  }
}
