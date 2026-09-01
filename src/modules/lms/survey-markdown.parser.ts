import { BadRequestException } from '@nestjs/common';

/**
 * Parser del formato de importación de encuestas: Markdown simple, inspirado en el espíritu de
 * texto-plano de los formatos de importación de Moodle (GIFT/Aiken) pero con la semántica propia
 * de una encuesta (sin respuesta correcta, tipo "escala" y "texto libre"). Ver docs/04.
 *
 * Metadatos opcionales antes de la primera pregunta: líneas "clave: valor" (hoy solo se usa
 * "anonymous: true/false").
 *
 * Cada pregunta es un encabezado H2: "## <enunciado> [<tipo>]", donde <tipo> es uno de
 * single | multiple | scale | text (default: single si trae opciones, text si no trae nada).
 * Para escala se puede indicar el rango: "[scale 1-5]" (default 1-5 si se omite).
 * Las líneas "- opción" inmediatamente debajo de una pregunta single/multiple son sus opciones.
 */

export type ParsedSurveyQuestionType = 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | 'SCALE' | 'TEXT';

export interface ParsedSurveyQuestion {
  text: string;
  type: ParsedSurveyQuestionType;
  options: string[];
  scale_min?: number;
  scale_max?: number;
}

export interface ParsedSurvey {
  anonymous?: boolean;
  questions: ParsedSurveyQuestion[];
}

const HEADING_RE = /^##\s+(.+?)(?:\s*\[([^\]]+)\])?$/;
const OPTION_RE = /^[-*]\s+(.+)$/;
const META_RE = /^([a-zA-Z_]+)\s*:\s*(.+)$/;

function mapType(raw?: string): ParsedSurveyQuestionType | undefined {
  const word = raw?.trim().toLowerCase();
  if (!word) return undefined;
  if (['single', 'unica', 'única', 'radio'].includes(word)) return 'SINGLE_CHOICE';
  if (['multiple', 'múltiple', 'checkbox'].includes(word)) return 'MULTIPLE_CHOICE';
  if (word === 'scale' || word === 'escala') return 'SCALE';
  if (['text', 'texto', 'open', 'abierta'].includes(word)) return 'TEXT';
  return undefined;
}

function parseBracket(raw?: string): { type?: ParsedSurveyQuestionType; min?: number; max?: number } {
  if (!raw) return {};
  const parts = raw.trim().split(/[\s:]+/).filter(Boolean);
  const type = mapType(parts[0]);
  const rangePart = parts.find((p) => /^\d+-\d+$/.test(p));
  if (!rangePart) return { type };
  const [min, max] = rangePart.split('-').map(Number);
  return { type, min, max };
}

export function parseSurveyMarkdown(markdown: string): ParsedSurvey {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const questions: ParsedSurveyQuestion[] = [];
  let anonymous: boolean | undefined;
  let current: ParsedSurveyQuestion | null = null;

  const finalize = (q: ParsedSurveyQuestion) => {
    if (!q.type) q.type = q.options.length > 0 ? 'SINGLE_CHOICE' : 'TEXT';
    if (q.type === 'SCALE') {
      q.scale_min = q.scale_min ?? 1;
      q.scale_max = q.scale_max ?? 5;
    }
    return q;
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    const heading = line.match(HEADING_RE);
    if (heading) {
      if (current) questions.push(finalize(current));
      const { type, min, max } = parseBracket(heading[2]);
      current = { text: heading[1].trim(), type: type as ParsedSurveyQuestionType, options: [], scale_min: min, scale_max: max };
      continue;
    }

    if (current) {
      const option = line.match(OPTION_RE);
      if (option) current.options.push(option[1].trim());
      continue;
    }

    const meta = line.match(META_RE);
    if (meta && meta[1].toLowerCase() === 'anonymous') {
      anonymous = /^(true|s[ií]|yes|1)$/i.test(meta[2].trim());
    }
  }
  if (current) questions.push(finalize(current));

  if (questions.length === 0) {
    throw new BadRequestException(
      'El archivo no contiene preguntas válidas. Usa encabezados "## <pregunta> [tipo]" (ver formato en la documentación).',
    );
  }
  return { anonymous, questions };
}
