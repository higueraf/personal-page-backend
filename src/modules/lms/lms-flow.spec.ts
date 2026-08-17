import { ForbiddenException } from '@nestjs/common';
import { FindOperator } from 'typeorm';
import { LmsCoursesService } from './lms-courses.service';
import { LmsActivitiesService } from './lms-activities.service';
import { LmsCourseStatus } from '../../entities/lms-course.entity';
import { LmsEnrollmentStatus } from '../../entities/lms-enrollment.entity';

/**
 * Repositorio en memoria que soporta el subconjunto de la API de
 * Repository<T> usado por los servicios del LMS (find/findOne/save/
 * create/delete/count con where por igualdad, FindOperator `In`, y el
 * caso especial `unit: { course_id }` que usan las consultas de progreso).
 * Solo para estas pruebas: no reemplaza una prueba de integración contra
 * Postgres real.
 */
function fakeRepo<T extends { id: string }>(relationResolvers: Record<string, (foreignId: string) => any> = {}) {
  const store = new Map<string, T>();
  let counter = 0;

  function matchesWhere(item: any, where: any): boolean {
    return Object.entries(where).every(([key, value]) => {
      if (value instanceof FindOperator) {
        if (value.type === 'in') return (value.value as any[]).includes(item[key]);
        throw new Error(`FindOperator no soportado en el fake: ${value.type}`);
      }
      if (key === 'unit' && value && typeof value === 'object') {
        return item.unit_id === (value as any).course_id;
      }
      return item[key] === value;
    });
  }

  // Simula TypeORM `relations: [...]`: adjunta la entidad relacionada buscándola
  // por convención `<relación>_id` en el store del repositorio correspondiente.
  function attachRelations(item: any, relations?: string[]) {
    if (!relations) return item;
    const withRelations = { ...item };
    for (const relation of relations) {
      const resolver = relationResolvers[relation];
      if (resolver) withRelations[relation] = resolver(item[`${relation}_id`]);
    }
    return withRelations;
  }

  return {
    store,
    create: (partial: Partial<T>) => ({ id: `id-${++counter}`, ...partial }) as T,
    save: jest.fn(async (entity: T) => {
      store.set(entity.id, entity);
      return entity;
    }),
    findOne: jest.fn(async ({ where, relations }: any) => {
      for (const item of store.values()) {
        if (matchesWhere(item, where)) return attachRelations(item, relations);
      }
      return null;
    }),
    find: jest.fn(async (opts: any = {}) => {
      const items = [...store.values()];
      const filtered = opts.where ? items.filter((item) => matchesWhere(item, opts.where)) : items;
      return filtered.map((item) => attachRelations(item, opts.relations));
    }),
    count: jest.fn(async (opts: any = {}) => {
      const items = [...store.values()];
      return opts.where ? items.filter((item) => matchesWhere(item, opts.where)).length : items.length;
    }),
    delete: jest.fn(async (id: string) => {
      store.delete(id);
    }),
  };
}

describe('LMS: flujo crear → publicar → visualizar, y control de acceso', () => {
  const teacherA = { id: 'teacher-a', role: { name: 'teacher' } } as any;
  const teacherB = { id: 'teacher-b', role: { name: 'teacher' } } as any;
  const student = { id: 'student-1', role: { name: 'student' } } as any;

  let coursesService: LmsCoursesService;
  let activitiesService: LmsActivitiesService;

  beforeEach(() => {
    const coursesRepo = fakeRepo<any>();
    const unitsRepo = fakeRepo<any>({ course: (id: string) => coursesRepo.store.get(id) });
    const activitiesRepo = fakeRepo<any>({ unit: (id: string) => unitsRepo.store.get(id) });
    const usersRepo = fakeRepo<any>();
    const enrollmentsRepo = fakeRepo<any>({
      course: (id: string) => coursesRepo.store.get(id),
      student: (id: string) => usersRepo.store.get(id),
    });
    const progressRepo = fakeRepo<any>();
    const studyCoursesRepo = fakeRepo<any>();

    coursesService = new LmsCoursesService(
      coursesRepo as any,
      unitsRepo as any,
      activitiesRepo as any,
      enrollmentsRepo as any,
      progressRepo as any,
      studyCoursesRepo as any,
      usersRepo as any,
    );
    activitiesService = new LmsActivitiesService(activitiesRepo as any, unitsRepo as any, progressRepo as any, coursesService);
  });

  it('permite crear, publicar y luego visualizar una actividad; sincroniza el progreso al completarla', async () => {
    const course = await coursesService.create({ title: 'Cálculo I' } as any, teacherA);
    expect(course.status).toBe(LmsCourseStatus.DRAFT);

    const unit = await coursesService.createUnit({ course: course.id, title: 'Unidad 1' } as any, teacherA);
    const activity = await activitiesService.create(
      { unit: unit.id, type: 'presentation', title: 'Introducción', config: { file_url: 'https://example.com/slides.pdf' } } as any,
      teacherA,
    );
    expect(activity.status).toBe('DRAFT');

    // Un alumno no puede inscribirse en un curso que todavía no está publicado.
    await expect(coursesService.enroll(course.id, student)).rejects.toThrow();

    await coursesService.update(course.id, { status: 'PUBLISHED' } as any, teacherA);
    await coursesService.updateUnit(unit.id, { status: 'PUBLISHED' } as any, teacherA);
    await activitiesService.update(activity.id, { status: 'PUBLISHED' } as any, teacherA);

    await coursesService.enroll(course.id, student);
    const { progress } = await activitiesService.studentView(activity.id, student);
    expect(progress.status).toBe('IN_PROGRESS');

    await activitiesService.markCompleted(activity.id, course.id, student.id, 95);

    const myCourses = await coursesService.myCourses(student);
    expect(myCourses).toHaveLength(1);
    expect(myCourses[0].progress_percent).toBe(100);
    expect(myCourses[0].status).toBe(LmsEnrollmentStatus.COMPLETED);
  });

  it('impide que un profesor administre el curso de otro profesor (admin sí puede)', async () => {
    const course = await coursesService.create({ title: 'Física I' } as any, teacherA);

    await expect(coursesService.getForManage(course.id, teacherB)).rejects.toThrow(ForbiddenException);

    const admin = { id: 'admin-1', role: { name: 'admin' } } as any;
    await expect(coursesService.getForManage(course.id, admin)).resolves.toMatchObject({ id: course.id });
  });

  it('impide que un alumno vea una actividad de un curso en el que no está inscrito', async () => {
    const course = await coursesService.create({ title: 'Química I' } as any, teacherA);
    const unit = await coursesService.createUnit({ course: course.id, title: 'Unidad 1' } as any, teacherA);
    const activity = await activitiesService.create({ unit: unit.id, type: 'presentation', title: 'Intro' } as any, teacherA);
    await coursesService.update(course.id, { status: 'PUBLISHED' } as any, teacherA);
    await activitiesService.update(activity.id, { status: 'PUBLISHED' } as any, teacherA);

    await expect(activitiesService.studentView(activity.id, student)).rejects.toThrow(ForbiddenException);
  });
});
