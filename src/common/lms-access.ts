import { ForbiddenException } from '@nestjs/common';

/** Admins tienen acceso total; un teacher solo sobre sus propios cursos. */
export function assertTeacherOwnsCourse(
  course: { teacher_id: string },
  user: { id: string; role?: { name?: string } },
) {
  const roleName = user.role?.name?.toLowerCase();
  if (roleName === 'admin') return;
  if (course.teacher_id !== user.id) {
    throw new ForbiddenException('No tienes permiso sobre este curso');
  }
}
