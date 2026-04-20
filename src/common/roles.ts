export const CONTENT_ROLES = ['admin', 'teacher', 'student'];

export function hasContentAccess(roleName?: string | null) {
  return !!roleName && CONTENT_ROLES.includes(roleName.toLowerCase());
}

/** Admins y teachers tienen acceso total, sin restricción por carrera */
export function isAdminOrTeacher(roleName?: string | null) {
  return !!roleName && ['admin', 'teacher'].includes(roleName.toLowerCase());
}
