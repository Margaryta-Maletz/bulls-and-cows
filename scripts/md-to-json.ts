/**
 * Converts a практикум markdown file to a questions JSON file.
 *
 * Usage:
 *   tsx scripts/md-to-json.ts <input.md> [output.json]
 *
 * Default output: questions/week-NN.json (derived from filename).
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, basename, dirname, resolve } from 'node:path';

interface Question {
  id: string;
  code: string;
  answers: string[];
}

const [,, inputPath, outputPath] = process.argv;

if (!inputPath) {
  console.error('Usage: tsx scripts/md-to-json.ts <input.md> [output.json]');
  process.exit(1);
}

const raw = readFileSync(resolve(inputPath), 'utf-8').replaceAll('\r\n', '\n');
const filename = basename(inputPath, '.md');

const weekMatch = /(\d+)/.exec(filename);
const weekNum = (weekMatch?.[1] ?? '00').padStart(2, '0');

function jsBlock(section: string): string | null {
  const m = /```js\n([\s\S]*?)\n```/.exec(section);
  return m ? m[1].trim() : null;
}

function answerBlock(section: string): string | null {
  const detailsMatch = /<details>[\s\S]*?<\/details>/.exec(section);
  if (!detailsMatch) return null;
  // First plain ``` block (no language) inside <details> is the answer
  const m = /```\n([\s\S]*?)\n```/.exec(detailsMatch[0]);
  return m ? m[1].trim() : null;
}

const sections = raw.split(/(?=###\s+Задача\s+\d)/i);
const questions: Question[] = [];

for (const section of sections) {
  if (!/###\s+Задача/i.test(section)) continue;
  const code = jsBlock(section);
  const answer = answerBlock(section);
  if (!code || !answer) continue;
  const n = questions.length + 1;
  questions.push({
    id: `w${weekNum}-${String(n).padStart(2, '0')}`,
    code,
    answers: [answer],
  });
}

const defaultOut = join(process.cwd(), 'questions', `week-${weekNum}.json`);
const out = outputPath ? resolve(outputPath) : defaultOut;
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(questions, null, 2) + '\n');
console.log(`Wrote ${questions.length} questions → ${out}`);
