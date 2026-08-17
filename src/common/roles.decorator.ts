import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/** Restringe una ruta a los roles indicados (Role.name, comparación case-insensitive). Usar junto con JwtAuthGuard + RolesGuard. */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
