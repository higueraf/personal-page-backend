/**
 * Catálogo de tipos de actividad soportados hoy por el LMS. Es una lista de
 * configuración, no un enum de base de datos: LmsActivity.type es un string
 * libre, así que agregar un tipo nuevo (o uno gestionado por otro módulo) no
 * requiere migración ni tocar las entidades existentes.
 */
export const LMS_ACTIVITY_TYPES = [
  'presentation',
  'forum',
  'assignment',
  'quiz',
  'exam',
] as const;

export type KnownLmsActivityType = (typeof LMS_ACTIVITY_TYPES)[number];

export function isKnownActivityType(type: string): type is KnownLmsActivityType {
  return (LMS_ACTIVITY_TYPES as readonly string[]).includes(type);
}
