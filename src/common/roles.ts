export const CONTENT_ROLES = ['admin', 'teacher', 'student'];
export function hasContentAccess(roleName?: string | null) {
  return !!roleName && CONTENT_ROLES.includes(roleName.toLowerCase());
}
