import { BadRequestException } from '@nestjs/common';

/**
 * Representación intermedia común que usan los 4 formatos de import/export de preguntas de quiz
 * (GIFT, Aiken, Moodle XML, Markdown propio) — cada parser/serializador solo traduce entre su
 * formato y esta forma; el resto del pipeline (validación, persistencia) es compartido.
 */
export interface ParsedQuizOption {
  text: string;
  is_correct: boolean;
}

export interface ParsedQuizQuestion {
  text: string;
  type: 'MULTIPLE_CHOICE' | 'MULTI_ANSWER' | 'OPEN';
  feedback?: string | null;
  options: ParsedQuizOption[];
}

export interface QuizFormatResult {
  questions: ParsedQuizQuestion[];
  warnings: string[];
}

export type QuizFileFormat = 'own' | 'gift' | 'aiken' | 'moodle_xml';

/**
 * Reglas compartidas por todos los formatos: MULTIPLE_CHOICE necesita exactamente una opción
 * correcta (si no, ¿cuál es "la" respuesta de un test de opción única?); MULTI_ANSWER necesita al
 * menos una. Se acumulan todos los errores en vez de abortar en el primero, para que el docente
 * vea de una sola vez todo lo que hay que corregir en el archivo.
 */
export function validateParsedQuestions(questions: ParsedQuizQuestion[]): void {
  const errors: string[] = [];
  questions.forEach((q, idx) => {
    const label = `Pregunta ${idx + 1} ("${q.text.slice(0, 60)}")`;
    if (q.type === 'OPEN') return;
    const correctCount = q.options.filter((o) => o.is_correct).length;
    if (q.type === 'MULTIPLE_CHOICE' && correctCount !== 1) {
      errors.push(`${label}: debe tener exactamente una opción marcada como correcta (tiene ${correctCount}).`);
    }
    if (q.type === 'MULTI_ANSWER' && correctCount < 1) {
      errors.push(`${label}: debe tener al menos una opción marcada como correcta.`);
    }
    if (q.options.length < 2) {
      errors.push(`${label}: necesita al menos 2 opciones.`);
    }
  });
  if (errors.length) {
    throw new BadRequestException(errors.join(' \n'));
  }
}
