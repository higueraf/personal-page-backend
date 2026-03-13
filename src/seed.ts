import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AppSeeder } from './database/app.seeder';

async function run() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const seeder = app.get(AppSeeder);
  await seeder.seed();
  await app.close();
}

run();
