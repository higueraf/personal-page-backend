import { BadRequestException } from '@nestjs/common';
import { ParsedQuizQuestion } from './quiz-question-format.types';

/**
 * Aiken: el formato de importación más simple del ecosistema Moodle. Solo representa preguntas de
 * opción única (sin verdadero/falso, sin ensayo, sin varias respuestas correctas) — cualquier otra
 * cosa está fuera de su alcance por diseño del formato, no es un recorte nuestro.
 *
 * ¿Quién introdujo las inspecciones de software...?
 * A. Edward Yourdon en Bell Labs, en los años 60
 * B. Barry Boehm en NASA, en los años 80
 * C. Watts Humphrey en SEI, en los años 90
 * D. Michael Fagan en IBM, en los años 70
 * ANSWER: D
 */

const OPTION_RE = /^([A-Z])[.)]\s+(.+)$/;
const ANSWER_RE = /^ANSWER:\s*([A-Z])$/i;

export function parseAiken(content: string): { questions: ParsedQuizQuestion[]; warnings: string[] } {
  const lines = content
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((l) => l.trim());

  const questions: ParsedQuizQuestion[] = [];
  let stem: string | null = null;
  let options: { letter: string; text: string }[] = [];

  for (const line of lines) {
    if (!line) continue;
    const answerMatch = line.match(ANSWER_RE);
    if (answerMatch && stem) {
      const correctLetter = answerMatch[1].toUpperCase();
      questions.push({
        text: stem,
        type: 'MULTIPLE_CHOICE',
        options: options.map((o) => ({ text: o.text, is_correct: o.letter === correctLetter })),
      });
      stem = null;
      options = [];
      continue;
    }
    const optionMatch = line.match(OPTION_RE);
    if (optionMatch && stem !== null) {
      options.push({ letter: optionMatch[1].toUpperCase(), text: optionMatch[2].trim() });
      continue;
    }
    if (stem === null) {
      stem = line;
    }
  }

  if (questions.length === 0) {
    throw new BadRequestException('El archivo Aiken no contiene preguntas reconocibles (enunciado + A./B./... + ANSWER: X).');
  }
  return { questions, warnings: [] };
}

export function serializeAiken(questions: ParsedQuizQuestion[]): { content: string; warnings: string[] } {
  const warnings: string[] = [];
  const blocks: string[] = [];
  for (const q of questions) {
    if (q.type !== 'MULTIPLE_CHOICE') {
      warnings.push(`Pregunta "${q.text.slice(0, 60)}": Aiken solo admite opción única, se omitió.`);
      continue;
    }
    const correctIdx = q.options.findIndex((o) => o.is_correct);
    const letters = 'ABCDEFGHIJ';
    const lines = q.options.map((o, i) => `${letters[i]}. ${o.text}`);
    blocks.push([q.text, ...lines, `ANSWER: ${letters[correctIdx]}`].join('\n'));
  }
  return { content: blocks.join('\n\n') + '\n', warnings };
}
