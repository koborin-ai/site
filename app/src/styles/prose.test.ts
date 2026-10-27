import { globSync, readFileSync } from 'node:fs';
import { unified } from 'unified';
import { VFile } from 'vfile';
import { beforeAll, describe, expect, it } from 'vitest';
import config from '../../astro.config.ts';
import { rehypeDiagrams } from '../plugins/rehype-diagrams';

const fence = (lang: string, body: string) => ['```' + lang, body, '```'].join('\n');

// Every construct articles use. Author classes arrive through raw HTML exactly as SiteImage renders them.
const FIXTURE = [
  '## 見出し', 'Text with **strong**, *em*, ~~del~~, `code`, and [a link](https://example.com).',
  '### Sub', '#### Minor', '##### Fifth', '###### Sixth',
  ':::note\nNote\n:::', ':::tip\nTip\n:::', ':::caution[Title]\nCaution\n:::', ':::danger\nDanger\n:::',
  fence('ts', 'const answer = 42; // comment'),
  '| a | b |\n| --- | ---: |\n| 1 | 2 |',
  '> **Note:** quote', '1. one\n   - nested\n2. two', '---',
  fence('mermaid', '---\ntitle: "Project"\n---\nflowchart LR\n  subgraph CI[GitHub]\n    A[Start]\n  end\n  A -->|label| B[(Store)]'),
  fence('mermaid', [
    'sequenceDiagram', '  autonumber', '  participant U as Browser', '  participant W as Worker',
    '  U->>W: GET', '  activate W', '  Note over U,W: note', '  alt hit', '    W-->>U: 200', '  else miss',
    '    W--xU: 404', '  end', '  loop retry', '    U->>W: again', '  end',
    '  rect rgb(240, 248, 255)', '    U->>W: tinted', '  end', '  W--)U: async', '  deactivate W',
  ].join('\n')),
  '<figure class="theme-figure"><picture><img class="theme-light" alt=""></picture>'
    + '<picture><img class="theme-dark" alt=""></picture><figcaption>caption</figcaption></figure>',
  '<details>\n<summary>more</summary>\n\nhidden\n\n</details>',
].join('\n\n');

const BODY = 'sl-markdown-content';
// rehype-heading-anchors borrows the global .sr-only utility from vendor/util.css.
const SHARED_UTILITIES = new Set(['sr-only']);
const SRC = new URL('../', import.meta.url);
const DIAGRAM = /<figure class="diagram">([\s\S]*?)<\/figure>/g;

let render: (markdown: string) => Promise<{ code: string }>;
let html = '';

beforeAll(async () => {
  const { processor, syntaxHighlight, shikiConfig } = config.markdown ?? {};
  if (!processor || typeof syntaxHighlight !== 'object' || !syntaxHighlight.type) {
    throw new Error('astro.config.ts must set markdown.processor and markdown.syntaxHighlight.type');
  }
  const renderer = await processor.createRenderer({
    syntaxHighlight: { ...syntaxHighlight, type: syntaxHighlight.type },
    shikiConfig,
  });
  render = (source) => renderer.render(source);
  html = (await render(FIXTURE)).code;
}, 120_000);

function selectorsOf(css: string): string[] {
  const preludes = css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{};]+)\{/g);
  return [...preludes]
    .map(([, prelude]) => prelude.trim())
    .filter((prelude) => prelude && !prelude.startsWith('@'))
    .flatMap((prelude) => prelude.split(/,(?![^(]*\))/).map((selector) => selector.trim()));
}

function classesIn(selector: string): string[] {
  const bare = selector.replace(/\[[^\]]*\]/g, '');
  return [...bare.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)].map(([, name]) => name);
}

function classAttributes(markup: string): Set<string> {
  return new Set([...markup.matchAll(/class="([^"]*)"/g)].flatMap(([, value]) => value.split(/\s+/)));
}

function emittedClasses(): Set<string> {
  return classAttributes(html.replace(DIAGRAM, '<figure class="diagram"></figure>'));
}

function stylesheets(): { file: string; css: string }[] {
  const css = globSync('**/*.css', { cwd: SRC })
    .filter((file) => file !== 'styles/prose.css')
    .map((file) => ({ file, css: readFileSync(new URL(file, SRC), 'utf8') }));
  const astro = globSync('**/*.astro', { cwd: SRC }).flatMap((file) =>
    [...readFileSync(new URL(file, SRC), 'utf8').matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(
      ([, block]) => ({ file, css: block }),
    ),
  );
  return [...css, ...astro];
}

function reachesIntoBody(selector: string): boolean {
  const outsideNot = selector.replace(/:not\([^()]*\)/g, '');
  return [...outsideNot.matchAll(/\.sl-markdown-content[^\s>+~),]*/g)].some((match) => {
    const rest = outsideNot.slice(match.index + match[0].length);
    return /^\s*>/.test(rest) || /^\s+[^\s+~),]/.test(rest);
  });
}

function diagrams(): { style: string; body: string }[] {
  return [...html.matchAll(DIAGRAM)].map(([, svg]) => ({
    style: [...svg.matchAll(/<style>([\s\S]*?)<\/style>/g)].map(([, css]) => css).join('\n'),
    body: svg.replace(/<style>[\s\S]*?<\/style>/g, ''),
  }));
}

describe('article body contract', () => {
  it('styles only classes the article pipeline emits', () => {
    const emitted = emittedClasses();
    const css = readFileSync(new URL('./prose.css', import.meta.url), 'utf8');
    const selected = selectorsOf(css).flatMap(classesIn).filter((name) => name !== BODY);
    expect(selected.filter((name) => !emitted.has(name))).toEqual([]);
  });

  it('leaves the article body to prose.css', () => {
    const owned = [...emittedClasses()].filter((name) => !SHARED_UTILITIES.has(name));
    const intrusions = stylesheets().flatMap(({ file, css }) =>
      selectorsOf(css)
        .filter((selector) => reachesIntoBody(selector) || classesIn(selector).some((name) => owned.includes(name)))
        .map((selector) => `${file}: ${selector}`),
    );
    expect(intrusions).toEqual([]);
  });

  it('paints every diagram class and marker it names', () => {
    const rendered = diagrams();
    const painted = rendered.flatMap(({ style }) =>
      selectorsOf(style.replace(/[^{}]*\{[^}]*\}/g, (rule) => (rule.includes('var(--diagram-') ? rule : ''))),
    );
    const classes = new Set(rendered.flatMap(({ body }) => [...classAttributes(body)]));
    const ids = rendered.flatMap(({ body }) => [...body.matchAll(/id="([^"]+)"/g)].map(([, id]) => id));
    const missingClasses = painted.flatMap(classesIn).filter((name) => !classes.has(name));
    const missingMarkers = painted
      .flatMap((selector) => [...selector.matchAll(/\[id\$="([^"]+)"\]/g)].map(([, suffix]) => suffix))
      .filter((suffix) => !ids.some((id) => id.endsWith(suffix)));
    expect(painted.length).toBeGreaterThan(0);
    expect([...new Set([...missingClasses, ...missingMarkers])]).toEqual([]);
  });

  it('wraps diagrams at natural size', () => {
    const roots = [...html.matchAll(/<figure class="diagram">(<svg[^>]*>)/g)].map(([, root]) => root);
    expect(roots).toHaveLength(2);
    for (const root of roots) {
      const [, , width, height] = root.match(/viewBox="([^"]+)"/)![1].split(/[\s,]+/);
      expect(root).toContain(` width="${width}"`);
      expect(root).toContain(` height="${height}"`);
      expect(root).not.toContain('max-width');
    }
    expect(html).not.toContain('width="100%"');
  });

  it('frames each table, leaving the table element intact', () => {
    expect(html.match(/<table>/g)).toHaveLength(1);
    expect(html.match(/<div class="table-frame">\s*<table>/g)).toHaveLength(1);
  });

  it('wraps tables and diagrams once when run twice', async () => {
    const table = { type: 'element', tagName: 'table', properties: {}, children: [] };
    const mdxTable = { type: 'mdxJsxFlowElement', name: 'table', attributes: [], children: [] };
    const svg = {
      type: 'element',
      tagName: 'svg',
      properties: { id: 'mermaid-0', ariaRoleDescription: 'sequence', viewBox: '0 0 10 10' },
      children: [],
    };
    const tree = { type: 'root', children: [table, mdxTable, svg] };
    const transform = rehypeDiagrams.call(unified());
    await transform(tree, new VFile());
    await transform(tree, new VFile());
    expect(tree.children).toEqual([
      { type: 'element', tagName: 'div', properties: { className: ['table-frame'] }, children: [table] },
      { type: 'element', tagName: 'div', properties: { className: ['table-frame'] }, children: [mdxTable] },
      { type: 'element', tagName: 'figure', properties: { className: ['diagram'] }, children: [svg] },
    ]);
  });

  it('fails the build on a diagram type with no paint', async () => {
    await expect(render(fence('mermaid', 'classDiagram\n  class Stack'))).rejects.toThrow(/classDiagram/);
  });
});
