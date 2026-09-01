import { BadRequestException } from '@nestjs/common';
import { ParsedQuizQuestion, QuizFormatResult } from './quiz-question-format.types';

/**
 * Subconjunto de GIFT (formato de importación de bancos de preguntas de Moodle) que mapea 1:1 con
 * nuestro modelo: opción única (=/~), opción múltiple ponderada (~%N%), verdadero/falso ({TRUE}/
 * {FALSE}), y respuesta corta/ensayo ({} o {=respuesta}) → OPEN. Lo que no mapea (emparejar,
 * numérica, cloze) se reporta como advertencia y esa pregunta se omite, sin abortar el resto del
 * archivo. Ver docs/05 para la gramática completa soportada.
 */

function stripComments(content: string): string {
  return content
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n');
}

const QUESTION_BLOCK_RE = /(?:::[^:]*::)?\s*([\s\S]*?)\{([\s\S]*?)\}/g;
const WEIGHTED_RE = /^([=~])\s*(?:%(-?\d+(?:\.\d+)?)%)?\s*(.*)$/s;

export function parseGift(content: string): QuizFormatResult {
  const cleaned = stripComments(content);
  const questions: ParsedQuizQuestion[] = [];
  const warnings: string[] = [];

  let match: RegExpExecArray | null;
  QUESTION_BLOCK_RE.lastIndex = 0;
  while ((match = QUESTION_BLOCK_RE.exec(cleaned))) {
    const stem = match[1].trim();
    const body = match[2].trim();
    if (!stem) continue;

    if (/^(TRUE|T|FALSE|F)$/i.test(body)) {
      const isTrue = /^(TRUE|T)$/i.test(body);
      questions.push({
        text: stem,
        type: 'MULTIPLE_CHOICE',
        options: [
          { text: 'Verdadero', is_correct: isTrue },
          { text: 'Falso', is_correct: !isTrue },
        ],
      });
      continue;
    }

    if (body.includes('->')) {
      warnings.push(`Pregunta "${stem.slice(0, 60)}": tipo "emparejar" no soportado, se omitió.`);
      continue;
    }
    if (/^#/.test(body)) {
      warnings.push(`Pregunta "${stem.slice(0, 60)}": tipo "numérica" no soportado, se omitió.`);
      continue;
    }

    const lines = body
      .split(/\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) {
      questions.push({ text: stem, type: 'OPEN', options: [] });
      continue;
    }
    if (lines.every((l) => l.startsWith('='))) {
      questions.push({ text: stem, type: 'OPEN', options: [] });
      continue;
    }

    const options = lines
      .map((line) => line.match(WEIGHTED_RE))
      .filter((m): m is RegExpMatchArray => !!m)
      .map((m) => ({
        is_correct: m[1] === '=' || (m[2] !== undefined && Number(m[2]) > 0),
        text: m[3].split('#')[0].trim(),
      }));
    if (options.length === 0) {
      warnings.push(`Pregunta "${stem.slice(0, 60)}": no se reconoció el formato de sus opciones, se omitió.`);
      continue;
    }
    const correctCount = options.filter((o) => o.is_correct).length;
    questions.push({
      text: stem,
      type: correctCount > 1 ? 'MULTI_ANSWER' : 'MULTIPLE_CHOICE',
      options,
    });
  }

  if (questions.length === 0) {
    throw new BadRequestException('El archivo GIFT no contiene preguntas reconocibles.');
  }
  return { questions, warnings };
}

export function serializeGift(questions: ParsedQuizQuestion[]): { content: string; warnings: string[] } {
  const warnings: string[] = [];
  const blocks = questions.map((q) => {
    if (q.type === 'OPEN') return `${q.text} {}`;
    const correct = q.options.filter((o) => o.is_correct);
    const lines =
      q.type === 'MULTI_ANSWER'
        ? q.options.map((o) => {
            const weight = o.is_correct ? Math.round(100 / correct.length) : -Math.round(100 / correct.length);
            return `~%${weight}%${o.text}`;
          })
        : q.options.map((o) => `${o.is_correct ? '=' : '~'}${o.text}`);
    return `${q.text} {\n${lines.join('\n')}\n}`;
  });
  if (questions.some((q) => q.type === 'MULTI_ANSWER')) {
    warnings.push(
      'Las preguntas de varias respuestas correctas se exportaron con pesos porcentuales (%N%): Moodle las calificaría con crédito parcial, distinto a la calificación todo-o-nada usada en esta plataforma.',
    );
  }
  return { content: blocks.join('\n\n') + '\n', warnings };
}
