import { BadRequestException } from '@nestjs/common';
import { ParsedQuizQuestion, QuizFormatResult } from './quiz-question-format.types';

/**
 * Formato propio de importación/exportación de quiz: Markdown real (encabezados H2 + listas),
 * hermano del ya usado para encuestas (survey-markdown.parser.ts) pero con marcador de
 * corrección: "-" para una opción incorrecta, "*" para una correcta. Ver docs/05.
 *
 * ## <enunciado> [single|multi|open]
 * - opción incorrecta
 * * opción correcta
 */

const HEADING_RE = /^##\s+(.+?)(?:\s*\[([^\]]+)\])?$/;
const OPTION_RE = /^([-*])\s+(.+)$/;

function mapType(raw?: string): ParsedQuizQuestion['type'] {
  const word = raw?.trim().toLowerCase();
  if (word === 'multi' || word === 'multiple') return 'MULTI_ANSWER';
  if (word === 'open' || word === 'texto' || word === 'text') return 'OPEN';
  return 'MULTIPLE_CHOICE';
}

export function parseQuizMarkdown(content: string): QuizFormatResult {
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const questions: ParsedQuizQuestion[] = [];
  let current: ParsedQuizQuestion | null = null;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    const heading = line.match(HEADING_RE);
    if (heading) {
      if (current) questions.push(current);
      current = { text: heading[1].trim(), type: mapType(heading[2]), options: [] };
      continue;
    }

    if (current) {
      const option = line.match(OPTION_RE);
      if (option) current.options.push({ text: option[2].trim(), is_correct: option[1] === '*' });
    }
  }
  if (current) questions.push(current);

  if (questions.length === 0) {
    throw new BadRequestException(
      'El archivo no contiene preguntas válidas. Usa encabezados "## <pregunta> [single|multi|open]".',
    );
  }
  return { questions, warnings: [] };
}

export function serializeQuizMarkdown(questions: ParsedQuizQuestion[]): { content: string; warnings: string[] } {
  const typeTag: Record<ParsedQuizQuestion['type'], string> = {
    MULTIPLE_CHOICE: 'single',
    MULTI_ANSWER: 'multi',
    OPEN: 'open',
  };
  const blocks = questions.map((q) => {
    const header = `## ${q.text} [${typeTag[q.type]}]`;
    const options = q.options.map((o) => `${o.is_correct ? '*' : '-'} ${o.text}`);
    return [header, ...options].join('\n');
  });
  return { content: blocks.join('\n\n') + '\n', warnings: [] };
}
