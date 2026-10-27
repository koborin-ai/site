import { readFileSync } from 'node:fs';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { chromium, type Page } from 'playwright';
import { describe, expect, it } from 'vitest';
import SiteHeader from './SiteHeader.astro';

const require = createRequire(import.meta.url);
const WIDTHS = [320, 390, 430, 768, 1280] as const;
const WORD_VISIBLE_AT = new Set<number>([390, 430, 768, 1280]);

function accessibleName(anchor: string): string {
  const withoutHidden = anchor.replace(
    /<([a-zA-Z][\w:-]*)\b[^>]*\baria-hidden="true"[^>]*>[\s\S]*?<\/\1>/g,
    '',
  );
  return withoutHidden.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function markAnchor(html: string): string {
  const anchor = html.match(/<a\b[^>]*class="mark"[^>]*>[\s\S]*?<\/a>/)?.[0];
  if (!anchor) throw new Error('home link missing');
  return anchor;
}

async function headerHtml(locale: 'en' | 'ja'): Promise<string> {
  const container = await AstroContainer.create();
  const html = await container.renderToString(SiteHeader, {
    props: {
      locale,
      enHref: '/',
      jaHref: '/ja/',
    },
  });
  return html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
}

function stylesheets(): string[] {
  const shellUrl = new URL('./SiteShell.astro', import.meta.url);
  const shell = readFileSync(shellUrl, 'utf8');
  return [...shell.matchAll(/import '(\.\.\/styles\/[^']+\.css)'/g)].map((match) =>
    pathToFileURL(fileURLToPath(new URL(match[1], shellUrl))).href,
  );
}

// AstroContainer omits a child component's style block. The theme control's size lives there.
function componentCss(file: string): string {
  const source = readFileSync(new URL(file, import.meta.url), 'utf8');
  return [...source.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((match) => match[1]).join('\n');
}

async function pageFile(html: string): Promise<string> {
  const font = pathToFileURL(
    require.resolve('@fontsource-variable/geist-mono/files/geist-mono-latin-wght-normal.woff2'),
  ).href;
  const directory = await mkdtemp(path.join(tmpdir(), 'header-'));
  const file = path.join(directory, 'header.html');
  const document = `<!doctype html>
<html lang="en" data-theme="dark">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${stylesheets().map((href) => `<link rel="stylesheet" href="${href}">`).join('\n')}
<style>
${componentCss('./ThemeSelect.astro')}
@font-face {
  font-family: "Geist Mono";
  font-style: normal;
  font-display: block;
  font-weight: 100 900;
  src: url("${font}") format("woff2");
}
</style>
</head>
<body>
${html}
</body>
</html>`;
  await writeFile(file, document);
  return file;
}

type Row = {
  width: number;
  headerHeight: number;
  childrenInside: boolean;
  toolsOverlap: boolean;
  wordVisible: boolean;
  name: string;
  mark: string;
  tools: string;
  gap: number;
};

async function measure(page: Page, width: number): Promise<Row> {
  await page.setViewportSize({ width, height: 800 });
  return page.evaluate((viewport) => {
    const header = document.querySelector('.site-header');
    const mark = document.querySelector('.mark');
    const word = document.querySelector('.mark-word');
    if (!header || !mark || !word) throw new Error('header markup missing');
    const inside = (rect: DOMRect) =>
      rect.left >= -0.5 && rect.top >= -0.5 && rect.right <= viewport + 0.5 && rect.bottom <= 800.5;
    const boxes = [mark, ...header.querySelectorAll('.header-tools > *')].map((element) =>
      element.getBoundingClientRect(),
    );
    let toolsOverlap = false;
    for (let index = 0; index < boxes.length; index += 1) {
      for (let next = index + 1; next < boxes.length; next += 1) {
        const left = boxes[index];
        const right = boxes[next];
        const overlap =
          left.left < right.right - 0.5 &&
          right.left < left.right - 0.5 &&
          left.top < right.bottom - 0.5 &&
          right.top < left.bottom - 0.5;
        if (overlap) toolsOverlap = true;
      }
    }
    const named = mark.cloneNode(true) as HTMLElement;
    named.querySelectorAll('[aria-hidden="true"]').forEach((node) => node.remove());
    const name = (named.textContent ?? '').replace(/\s+/g, ' ').trim();
    const markBox = mark.getBoundingClientRect();
    const toolBoxes = [...header.querySelectorAll('.header-tools > *')].map((element) =>
      element.getBoundingClientRect(),
    );
    const firstTool = toolBoxes[0];
    const lastTool = toolBoxes[toolBoxes.length - 1];
    const wordBox = word.getBoundingClientRect();
    return {
      width: viewport,
      headerHeight: Math.round(header.getBoundingClientRect().height * 100) / 100,
      childrenInside: [...header.children].every((element) => inside(element.getBoundingClientRect())),
      toolsOverlap,
      wordVisible: wordBox.width > 8 && wordBox.height > 8,
      name,
      mark: `${markBox.left.toFixed(1)}-${markBox.right.toFixed(1)} (${markBox.width.toFixed(1)}x${markBox.height.toFixed(1)})`,
      tools: firstTool && lastTool ? `${firstTool.left.toFixed(1)}-${lastTool.right.toFixed(1)}` : '',
      gap: firstTool ? Math.round((firstTool.left - markBox.right) * 10) / 10 : 0,
    };
  }, width);
}

describe('SiteHeader', () => {
  it.each(['en', 'ja'] as const)('names the one home link in %s', async (locale) => {
    const html = await headerHtml(locale);
    const anchor = markAnchor(html);
    const home = locale === 'ja' ? '/ja/' : '/';
    const hrefs = [...html.matchAll(/\bhref="([^"]*)"/g)].map((match) => match[1]);
    expect(hrefs.filter((href) => href === home)).toEqual([home]);
    expect(anchor.match(/\bhref="([^"]*)"/)?.[1]).toBe(home);
    expect(anchor).toMatch(/<svg\b[^>]*\baria-hidden="true"/);
    expect(accessibleName(anchor)).toBe('koborin.ai');
  });

  it('keeps the row inside the viewport', async () => {
    const file = await pageFile(await headerHtml('en'));
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    try {
      await page.goto(pathToFileURL(file).href);
      const font = await page.evaluate(async () => {
        await document.fonts.load('500 13px "Geist Mono"');
        await document.fonts.ready;
        const canvas = document.createElement('canvas').getContext('2d');
        if (!canvas) return { loaded: false, geist: 0, fallback: 0 };
        canvas.font = '500 13px "Geist Mono"';
        const geist = canvas.measureText('koborin.ai').width;
        canvas.font = '500 13px monospace';
        const fallback = canvas.measureText('koborin.ai').width;
        return {
          loaded: document.fonts.check('500 13px "Geist Mono"'),
          geist,
          fallback,
          family: getComputedStyle(document.querySelector('.mark-word')!).fontFamily,
        };
      });
      expect(font.loaded).toBe(true);
      expect(font.geist).not.toBe(font.fallback);
      expect(font.family).toContain('Geist Mono');

      for (const width of WIDTHS) {
        const row = await measure(page, width);
        expect(row.childrenInside, JSON.stringify(row)).toBe(true);
        expect(row.toolsOverlap, JSON.stringify(row)).toBe(false);
        expect(row.headerHeight, JSON.stringify(row)).toBeLessThanOrEqual(62);
        expect(row.name).toBe('koborin.ai');
        expect(await page.getByRole('link', { name: 'koborin.ai', exact: true }).count()).toBe(1);
        if (WORD_VISIBLE_AT.has(width)) expect(row.wordVisible, JSON.stringify(row)).toBe(true);
      }
    } finally {
      await browser.close();
    }
  }, 60_000);
});
