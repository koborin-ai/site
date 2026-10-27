import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createInterface, type Interface } from 'node:readline/promises';

export type ArticleLanguage = 'ja' | 'en';
export type ArticleCategory = 'tech' | 'life';

export type ArticleAnswers = {
  lang: ArticleLanguage;
  category: ArticleCategory;
  title: string;
  description: string;
};

export type ArticleFile = {
  path: string;
  contents: string;
};

type Choice<T extends string> = {
  readonly label: string;
  readonly value: T;
};

const LANGUAGES = [
  { label: 'Japanese', value: 'ja' },
  { label: 'English', value: 'en' },
] as const satisfies readonly Choice<ArticleLanguage>[];

const CATEGORIES = [
  { label: 'Tech - Technical articles', value: 'tech' },
  { label: 'Life - Lifestyle, hobbies', value: 'life' },
] as const satisfies readonly Choice<ArticleCategory>[];

const XML_ESCAPE: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&#34;',
  "'": '&#39;',
};

function escapeXml(value: string): string {
  return value.replace(/[&<>'"]/g, (char) => XML_ESCAPE[char] ?? char);
}

function toSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

export function articleFile(answers: ArticleAnswers, publishedOn: string): ArticleFile {
  const slug = toSlug(answers.title);
  const langPath = answers.lang === 'ja' ? 'ja/' : '';
  return {
    path: `src/content/docs/${langPath}${answers.category}/${slug}.mdx`,
    contents: [
      '---',
      `title: ${escapeXml(answers.title)}`,
      `description: ${escapeXml(answers.description)}`,
      `publishedAt: ${publishedOn}`,
      '---',
      '',
      '## Introduction',
      '',
      'Write your article content here.',
      '',
      '## Conclusion',
      '',
    ].join('\n'),
  };
}

function matchChoice<T extends string>(answer: string, choices: readonly Choice<T>[]): T | undefined {
  const trimmed = answer.trim();
  if (/^\d+$/.test(trimmed)) return choices[Number(trimmed) - 1]?.value;
  const folded = trimmed.toLowerCase();
  return choices.find((choice) => choice.value === folded || choice.label.toLowerCase() === folded)?.value;
}

// question() drops lines that arrive before the next call when stdin is a pipe.
function nextLine(rl: Interface): () => Promise<string> {
  const pending: string[] = [];
  const waiters: Array<{
    resolve: (line: string) => void;
    reject: (error: Error) => void;
  }> = [];
  let closed = false;
  rl.on('line', (line) => {
    const waiter = waiters.shift();
    if (waiter) waiter.resolve(line);
    else pending.push(line);
  });
  rl.on('close', () => {
    closed = true;
    for (const waiter of waiters.splice(0)) waiter.reject(new Error('Unexpected end of input'));
  });
  return () => {
    const queued = pending.shift();
    if (queued !== undefined) return Promise.resolve(queued);
    if (closed) return Promise.reject(new Error('Unexpected end of input'));
    return new Promise((resolve, reject) => {
      waiters.push({ resolve, reject });
    });
  };
}

async function askChoice<T extends string>(
  read: () => Promise<string>,
  message: string,
  choices: readonly Choice<T>[],
): Promise<T> {
  const menu = choices.map((choice, index) => `  ${index + 1}) ${choice.label}`).join('\n');
  for (;;) {
    process.stdout.write(`${message}\n${menu}\n`);
    const matched = matchChoice(await read(), choices);
    if (matched !== undefined) return matched;
    process.stdout.write('Choose a listed option.\n');
  }
}

async function askRequired(read: () => Promise<string>, message: string, emptyMessage: string): Promise<string> {
  for (;;) {
    process.stdout.write(`${message}\n`);
    const answer = await read();
    if (answer) return answer;
    process.stdout.write(`${emptyMessage}\n`);
  }
}

async function main(): Promise<void> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const read = nextLine(rl);
  try {
    const lang = await askChoice(read, 'What language will you write this article in?', LANGUAGES);
    const category = await askChoice(read, 'Which category?', CATEGORIES);
    const title = await askRequired(read, 'Article title?', 'Title is required');
    const description = await askRequired(read, 'Brief description (one sentence)?', 'Description is required');
    const draft = articleFile({ lang, category, title, description }, new Date().toISOString().split('T')[0]);
    if (existsSync(draft.path)) {
      process.stdout.write(`exists: ${draft.path}. Overwrite? (y/N) `);
      const overwrite = (await read()).trim().toLowerCase();
      if (overwrite !== 'y' && overwrite !== 'yes') {
        process.stdout.write(`skipped: ${draft.path}\n`);
        return;
      }
    }
    await mkdir(path.dirname(draft.path), { recursive: true });
    await writeFile(draft.path, draft.contents);
    process.stdout.write(`added: ${draft.path}\n`);
  } finally {
    rl.close();
  }
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
