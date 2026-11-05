import { ForbiddenException } from '@nestjs/common';

/** Admins tienen acceso total; un teacher solo sobre cursos de los que es dueño o co-profesor. */
export function assertTeacherOwnsCourse(
  course: { teacher_id: string; co_teachers?: { id: string }[] },
  user: { id: string; role?: { name?: string } },
) {
  const roleName = user.role?.name?.toLowerCase();
  if (roleName === 'admin') return;
  const isOwner = course.teacher_id === user.id;
  const isCoTeacher = course.co_teachers?.some((t) => t.id === user.id) ?? false;
  if (!isOwner && !isCoTeacher) {
    throw new ForbiddenException('No tienes permiso sobre este curso');
  }
}
