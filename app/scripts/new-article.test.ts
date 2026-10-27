import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { articleFile, type ArticleAnswers } from './new-article.ts';

const script = fileURLToPath(new URL('./new-article.ts', import.meta.url));
const publishedOn = '2026-10-27';

const page = (title: string, description: string) =>
  [
    '---',
    `title: ${title}`,
    `description: ${description}`,
    `publishedAt: ${publishedOn}`,
    '---',
    '',
    '## Introduction',
    '',
    'Write your article content here.',
    '',
    '## Conclusion',
    '',
  ].join('\n');

describe('articleFile', () => {
  it('writes the article scaffold for a fixed set of answers', () => {
    const cases: { answers: ArticleAnswers; path: string; title: string; description: string }[] = [
      {
        answers: { lang: 'ja', category: 'tech', title: 'Hello World', description: 'A sentence.' },
        path: 'src/content/docs/ja/tech/hello-world.mdx',
        title: 'Hello World',
        description: 'A sentence.',
      },
      {
        answers: { lang: 'en', category: 'life', title: 'Hello, World!', description: `A & B <test> "q" 'z'` },
        path: 'src/content/docs/life/hello-world.mdx',
        title: 'Hello, World!',
        description: 'A &amp; B &lt;test&gt; &#34;q&#34; &#39;z&#39;',
      },
      {
        answers: { lang: 'ja', category: 'tech', title: '  Hello', description: 'd' },
        path: 'src/content/docs/ja/tech/-hello.mdx',
        title: '  Hello',
        description: 'd',
      },
      {
        answers: { lang: 'en', category: 'life', title: '日本語', description: 'd' },
        path: 'src/content/docs/life/.mdx',
        title: '日本語',
        description: 'd',
      },
      {
        answers: { lang: 'en', category: 'tech', title: '!!!', description: 'd' },
        path: 'src/content/docs/tech/.mdx',
        title: '!!!',
        description: 'd',
      },
      {
        answers: { lang: 'ja', category: 'tech', title: 'Hello   World--', description: 'd' },
        path: 'src/content/docs/ja/tech/hello-world-.mdx',
        title: 'Hello   World--',
        description: 'd',
      },
    ];

    for (const item of cases) {
      expect(articleFile(item.answers, publishedOn)).toEqual({
        path: item.path,
        contents: page(item.title, item.description),
      });
    }
  });
});

function run(cwd: string, input: string) {
  return spawnSync(process.execPath, [script], { cwd, input, encoding: 'utf8' });
}

describe('new-article cli', () => {
  it('writes a japanese tech article from the same questions', async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), 'new-article-'));
    const before = new Date().toISOString().split('T')[0];
    const result = run(cwd, '1\n1\nHello World\nA sentence.\n');
    const after = new Date().toISOString().split('T')[0];
    const relative = 'src/content/docs/ja/tech/hello-world.mdx';

    expect(result.status).toBe(0);
    expect(result.stdout).toContain(`added: ${relative}`);
    const contents = await readFile(path.join(cwd, relative), 'utf8');
    const expected = [before, after].map(
      (day) => articleFile({ lang: 'ja', category: 'tech', title: 'Hello World', description: 'A sentence.' }, day).contents,
    );
    expect(expected).toContain(contents);
  });

  it('asks again after an empty title and skips an overwrite unless the answer is yes', async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), 'new-article-'));
    const relative = 'src/content/docs/tech/hello-world.mdx';
    const created = run(cwd, 'English\nTech - Technical articles\n\nHello World\nA sentence.\n');
    expect(created.status).toBe(0);
    const original = await readFile(path.join(cwd, relative), 'utf8');

    const skipped = run(cwd, '2\n1\nHello World\nA sentence.\nn\n');
    expect(skipped.status).toBe(0);
    expect(skipped.stdout).toContain(`skipped: ${relative}`);
    await expect(readFile(path.join(cwd, relative), 'utf8')).resolves.toBe(original);

    const replaced = run(cwd, 'en\ntech\nHello World\nA new sentence.\nyes\n');
    expect(replaced.status).toBe(0);
    expect(replaced.stdout).toContain(`added: ${relative}`);
    const next = await readFile(path.join(cwd, relative), 'utf8');
    expect(next).not.toBe(original);
    expect(next).toContain('description: A new sentence.');
  });
});
