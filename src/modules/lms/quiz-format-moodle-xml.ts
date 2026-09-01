import { BadRequestException } from '@nestjs/common';
import { parseStringPromise, Builder } from 'xml2js';
import { ParsedQuizQuestion } from './quiz-question-format.types';

/**
 * Subconjunto de Moodle XML: <question type="multichoice"> (usa <single> para decidir opción
 * única vs. varias correctas, fraction > 0 = correcta), "truefalse" (→ opción única de 2) y
 * "essay"/"shortanswer" (→ OPEN). El marcador de carpeta type="category" se ignora sin error;
 * "matching"/"numerical"/"cloze"/"description" se reportan como advertencia y se omiten.
 */

function text(node: any): string {
  if (node == null) return '';
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return text(node[0]);
  if (typeof node === 'object' && '_' in node) return String(node._).trim();
  return String(node).trim();
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, '').trim();
}

export async function parseMoodleXml(content: string): Promise<{ questions: ParsedQuizQuestion[]; warnings: string[] }> {
  let parsed: any;
  try {
    parsed = await parseStringPromise(content);
  } catch (err: any) {
    throw new BadRequestException(`XML inválido: ${err.message}`);
  }

  const rawQuestions = parsed?.quiz?.question ?? [];
  const questions: ParsedQuizQuestion[] = [];
  const warnings: string[] = [];

  for (const q of rawQuestions) {
    const type = q.$?.type;
    const stem = stripHtml(text(q.questiontext?.[0]?.text));
    if (type === 'category') continue;

    if (type === 'multichoice') {
      const single = text(q.single?.[0]) !== 'false';
      const answers = (q.answer ?? []).map((a: any) => ({
        text: stripHtml(text(a.text)),
        is_correct: Number(a.$?.fraction ?? '0') > 0,
      }));
      questions.push({ text: stem, type: single ? 'MULTIPLE_CHOICE' : 'MULTI_ANSWER', options: answers });
      continue;
    }
    if (type === 'truefalse') {
      const answers = q.answer ?? [];
      const trueAnswer = answers.find((a: any) => /true/i.test(text(a.text)));
      const isTrue = Number(trueAnswer?.$?.fraction ?? '0') > 0;
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
    if (type === 'essay' || type === 'shortanswer' || type === 'description') {
      if (type === 'description') continue; // texto informativo, no es una pregunta real
      questions.push({ text: stem, type: 'OPEN', options: [] });
      continue;
    }

    warnings.push(`Pregunta "${stem.slice(0, 60)}": tipo "${type}" no soportado, se omitió.`);
  }

  if (questions.length === 0) {
    throw new BadRequestException('El XML no contiene preguntas de un tipo soportado (multichoice, truefalse, essay, shortanswer).');
  }
  return { questions, warnings };
}

export function serializeMoodleXml(questions: ParsedQuizQuestion[]): { content: string; warnings: string[] } {
  const builder = new Builder({ headless: false, rootName: 'quiz' });
  const questionNodes = questions.map((q) => {
    if (q.type === 'OPEN') {
      return {
        $: { type: 'essay' },
        name: { text: q.text.slice(0, 80) },
        questiontext: { $: { format: 'html' }, text: q.text },
      };
    }
    return {
      $: { type: 'multichoice' },
      name: { text: q.text.slice(0, 80) },
      questiontext: { $: { format: 'html' }, text: q.text },
      single: q.type === 'MULTIPLE_CHOICE' ? 'true' : 'false',
      answer: q.options.map((o) => ({
        $: { fraction: o.is_correct ? '100' : '0' },
        text: o.text,
      })),
    };
  });
  const xml = builder.buildObject({ question: questionNodes });
  return { content: xml, warnings: [] };
}
