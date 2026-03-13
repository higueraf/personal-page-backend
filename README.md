# Personal Page Backend (NestJS)

Backend listo para el frontend `personal-page-frontend`.

## Incluye

- NestJS + TypeORM + PostgreSQL
- prefijo global `/api`
- JWT en cookie httpOnly
- tablas automáticas con `TYPEORM_SYNC=true`
- seed manual y seed opcional al arrancar con `RUN_SEED=true`
- CRUD completo para:
  - courses
  - course-sections
  - lessons
  - lesson-pages
  - content-blocks
  - video-courses
  - video-sections
  - video-lessons
- endpoints públicos para tutoriales, cursos y lecciones
- streaming básico para `video_file`

## Instalación

```bash
npm install
cp .env.example .env
npm run seed
npm run start:dev
```

## Con Docker

```bash
docker compose up --build
```

## Seed

```bash
npm run seed
```

Credenciales:

- admin@personal.page / Admin123*
- student@personal.page / Student123*

## Variables importantes

- `TYPEORM_SYNC=true` crea las tablas automáticamente
- `RUN_SEED=true` ejecuta el seed al arrancar
