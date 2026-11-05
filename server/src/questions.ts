import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Question } from '@ws-quiz/shared';

const questionsDir = join(__dirname, '..', '..', 'questions');

export function loadQuestions(filename: string): Map<string, Question> {
  const raw = readFileSync(join(questionsDir, filename), 'utf-8');
  const list = JSON.parse(raw) as Question[];
  return new Map(list.map((q) => [q.id, q]));
}
