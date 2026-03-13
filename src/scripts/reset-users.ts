/**
 * reset-users.ts
 * ─────────────────────────────────────────────────────────────────
 * Elimina todos los usuarios existentes y recrea los seed con
 * contraseñas encriptadas y status APPROVED.
 *
 * Uso desde la raíz del proyecto backend:
 *   npx ts-node -r tsconfig-paths/register src/scripts/reset-users.ts
 * ─────────────────────────────────────────────────────────────────
 */
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import bcrypt from 'bcrypt';
import { User, UserStatus } from '../entities/user.entity';
import { Role } from '../entities/role.entity';

interface SeedUser {
  first_name: string;
  last_name:  string;
  email:      string;
  password:   string;
  role_name:  string;
  status:     UserStatus;
}

const USERS: SeedUser[] = [
  {
    first_name: 'Admin',
    last_name:  'Sistema',
    email:      'admin@personal.page',
    password:   'Admin123*',
    role_name:  'admin',
    status:     UserStatus.APPROVED,
  },
  {
    first_name: 'Demo',
    last_name:  'Teacher',
    email:      'teacher@personal.page',
    password:   'Teacher123*',
    role_name:  'teacher',
    status:     UserStatus.APPROVED,
  },
  {
    first_name: 'Demo',
    last_name:  'Student',
    email:      'student@personal.page',
    password:   'Student123*',
    role_name:  'student',
    status:     UserStatus.APPROVED,
  },
];

async function run() {
  const app = await NestFactory.createApplicationContext(AppModule);

  const usersRepo  = app.get<Repository<User>>(getRepositoryToken(User));
  const rolesRepo  = app.get<Repository<Role>>(getRepositoryToken(Role));
  const dataSource = app.get(DataSource);

  console.log('\n🗑  Eliminando usuarios existentes…');
  // TRUNCATE es la forma más limpia; CASCADE elimina FK dependientes si las hubiera
  await dataSource.query('TRUNCATE TABLE users RESTART IDENTITY CASCADE');
  console.log('   ✓ Tabla users vaciada\n');

  for (const u of USERS) {
    const role = await rolesRepo.findOne({ where: { name: u.role_name } });
    if (!role) {
      console.warn(`   ⚠ Rol "${u.role_name}" no encontrado, omitiendo ${u.email}`);
      continue;
    }
    const password_hash = await bcrypt.hash(u.password, 10);
    const user = usersRepo.create({
      first_name:    u.first_name,
      last_name:     u.last_name,
      email:         u.email,
      password_hash,
      role,
      status:        u.status,
      is_active:     true,
    });
    await usersRepo.save(user);
    console.log(`   ✓ ${u.email}  →  ${u.role_name} · ${u.status}`);
  }

  console.log('\n✅ Reset completado.\n');
  await app.close();
}

run().catch((e) => { console.error(e); process.exit(1); });
