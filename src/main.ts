import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { join } from 'path';
import { mkdirSync } from 'fs';
import { AppModule } from './app.module';
import { AppSeeder } from './database/app.seeder';

async function bootstrap() {
  // Ensure uploads directory exists before the server starts
  mkdirSync(join(process.cwd(), 'uploads', 'avatars'), { recursive: true });

  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.setGlobalPrefix('api');
  app.enableCors({
    origin: process.env.APP_ORIGINS?.split(',') || [
      'http://localhost:5173'
    ],
    credentials: true,
  });
  app.useWebSocketAdapter(new IoAdapter(app));
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.use(cookieParser());

  // Serve uploaded files (avatars, etc.) at /uploads/* — no /api prefix
  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads' });

  // Ejecutar el seed después de iniciar la aplicación
  /*
  const seeder = app.get(AppSeeder);
  await seeder.seed();
  console.log('✅ Seed ejecutado - Datos verificados/creados exitosamente');
*/
  const port = Number(process.env.PORT || 8000);
  await app.listen(port);
  console.log(`API running on http://localhost:${port}/api`);
}

bootstrap();
