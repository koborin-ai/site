import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { convert } from 'fontverter';
import subsetFont from 'subset-font';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(scriptDir, '..');

export const WEIGHTS = [400, 500] as const;
export type FontWeight = (typeof WEIGHTS)[number];

const SOURCE_FILE: Record<FontWeight, string> = {
  400: 'noto-sans-jp-japanese-400-normal.woff2',
  500: 'noto-sans-jp-japanese-500-normal.woff2',
};

export const STYLESHEET_NAME = 'noto-sans-jp.css';

const TEXT_EXTENSIONS = new Set(['.md', '.mdx', '.astro', '.ts', '.css', '.json', '.txt', '.svg', '.html']);

export const BASE_RANGES: readonly (readonly [number, number])[] = [
  [0x0020, 0x007e],
  [0x00a0, 0x00a0],
  [0x00b7, 0x00b7],
  [0x00d7, 0x00d7],
  [0x2010, 0x2015],
  [0x2018, 0x201d],
  [0x2025, 0x2026],
  [0x2032, 0x2033],
  [0x3000, 0x303f],
  [0x3040, 0x309f],
  [0x30a0, 0x30ff],
  [0x31f0, 0x31ff],
  [0xff00, 0xffef],
];

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: '\u00a0',
  hellip: '\u2026',
  mdash: '\u2014',
  ndash: '\u2013',
  times: '\u00d7',
  middot: '\u00b7',
};

type FaceFile = { weight: FontWeight; href: string };

type VerticalMetrics = { unitsPerEm: number; ascent: number; descent: number; lineGap: number };

export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (entity, body: string) => {
    const code = body.startsWith('#x')
      ? Number.parseInt(body.slice(2), 16)
      : body.startsWith('#')
        ? Number.parseInt(body.slice(1), 10)
        : null;
    if (code === null) return NAMED_ENTITIES[body] ?? entity;
    if (!Number.isInteger(code) || code < 0 || code > 0x10ffff) return entity;
    return String.fromCodePoint(code);
  });
}

export function collectCharacters(parts: readonly string[]): number[] {
  const codes = new Set<number>();
  for (const [start, end] of BASE_RANGES) {
    for (let code = start; code <= end; code += 1) codes.add(code);
  }
  for (const part of parts) {
    for (const char of decodeEntities(part)) {
      const code = char.codePointAt(0);
      if (code === undefined || code < 0x20) continue;
      codes.add(code);
    }
  }
  return [...codes].toSorted((left, right) => left - right);
}

export function charactersToText(codes: readonly number[]): string {
  let text = '';
  for (let index = 0; index < codes.length; index += 10000) {
    text += String.fromCodePoint(...codes.slice(index, index + 10000));
  }
  return text;
}

function hex(code: number): string {
  return code.toString(16).toUpperCase();
}

export function unicodeRange(codes: readonly number[]): string {
  const parts: string[] = [];
  let index = 0;
  while (index < codes.length) {
    const start = codes[index] ?? 0;
    let end = start;
    while (index + 1 < codes.length && codes[index + 1] === end + 1) {
      index += 1;
      end = codes[index] ?? end;
    }
    parts.push(start === end ? `U+${hex(start)}` : `U+${hex(start)}-${hex(end)}`);
    index += 1;
  }
  return parts.join(', ');
}

export function verticalOverrides(metrics: VerticalMetrics): { ascent: string; descent: string; lineGap: string } {
  const format = (value: number) => {
    const percent = Math.round((Math.abs(value) / metrics.unitsPerEm) * 1000) / 10;
    return `${percent}%`;
  };
  return { ascent: format(metrics.ascent), descent: format(metrics.descent), lineGap: format(metrics.lineGap) };
}

export function fontFaceCss(faces: readonly FaceFile[], range: string): string {
  return `${faces.map((face) => `@font-face {
  font-family: "Noto Sans JP";
  font-style: normal;
  font-weight: ${face.weight};
  font-display: swap;
  src: url("${face.href}") format("woff2");
  unicode-range: ${range};
}`).join('\n\n')}
`;
}

function asBuffer(bytes: Uint8Array): Buffer {
  return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

function viewOf(bytes: Uint8Array): DataView {
  const copy = asBuffer(bytes);
  return new DataView(copy.buffer, copy.byteOffset, copy.byteLength);
}

function tagAt(view: DataView, offset: number): string {
  return String.fromCharCode(
    view.getUint8(offset),
    view.getUint8(offset + 1),
    view.getUint8(offset + 2),
    view.getUint8(offset + 3),
  );
}

function tableOffset(view: DataView, tag: string): number | undefined {
  const numTables = view.getUint16(4);
  for (let index = 0; index < numTables; index += 1) {
    const entry = 12 + index * 16;
    if (tagAt(view, entry) === tag) return view.getUint32(entry + 8);
  }
  return undefined;
}

export function readVerticalMetrics(sfnt: Uint8Array): VerticalMetrics {
  const view = viewOf(sfnt);
  const head = tableOffset(view, 'head');
  const hhea = tableOffset(view, 'hhea');
  if (head === undefined || hhea === undefined) throw new Error('font is missing head or hhea');
  return {
    unitsPerEm: view.getUint16(head + 18),
    ascent: view.getInt16(hhea + 4),
    descent: view.getInt16(hhea + 6),
    lineGap: view.getInt16(hhea + 8),
  };
}

function addFormat4(view: DataView, offset: number, codes: Set<number>): void {
  const segCount = view.getUint16(offset + 6) / 2;
  const endCount = offset + 14;
  const startCount = endCount + segCount * 2 + 2;
  const idDelta = startCount + segCount * 2;
  const idRangeOffset = idDelta + segCount * 2;
  for (let index = 0; index < segCount; index += 1) {
    const end = view.getUint16(endCount + index * 2);
    const start = view.getUint16(startCount + index * 2);
    if (start === 0xffff || end < start) continue;
    const delta = view.getInt16(idDelta + index * 2);
    const rangeOffset = view.getUint16(idRangeOffset + index * 2);
    for (let code = start; code <= end; code += 1) {
      let glyphId: number;
      if (rangeOffset === 0) {
        glyphId = (code + delta) & 0xffff;
      } else {
        const glyphOffset = idRangeOffset + index * 2 + rangeOffset + (code - start) * 2;
        glyphId = view.getUint16(glyphOffset);
        if (glyphId !== 0) glyphId = (glyphId + delta) & 0xffff;
      }
      if (glyphId !== 0) codes.add(code);
    }
  }
}

function addFormat12(view: DataView, offset: number, codes: Set<number>): void {
  const groups = view.getUint32(offset + 12);
  let position = offset + 16;
  for (let index = 0; index < groups; index += 1) {
    const start = view.getUint32(position);
    const end = view.getUint32(position + 4);
    const glyph = view.getUint32(position + 8);
    position += 12;
    if (end < start || end - start > 100000) continue;
    for (let code = start; code <= end; code += 1) {
      if (glyph + (code - start) !== 0) codes.add(code);
    }
  }
}

export function codesInFont(sfnt: Uint8Array): Set<number> {
  const view = viewOf(sfnt);
  const cmap = tableOffset(view, 'cmap');
  if (cmap === undefined) throw new Error('font is missing cmap');
  const subtables = view.getUint16(cmap + 2);
  const codes = new Set<number>();
  for (let index = 0; index < subtables; index += 1) {
    const entry = cmap + 4 + index * 8;
    const offset = cmap + view.getUint32(entry + 4);
    const format = view.getUint16(offset);
    if (format === 4) addFormat4(view, offset, codes);
    if (format === 12) addFormat12(view, offset, codes);
  }
  if (codes.size === 0) throw new Error('font cmap has no glyphs');
  return codes;
}

function sourcePath(weight: FontWeight): string {
  return path.join(appDir, 'node_modules', '@fontsource', 'noto-sans-jp', 'files', SOURCE_FILE[weight]);
}

async function walk(dir: string, htmlOnly: boolean): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const nested = await Promise.all(entries.map(async (entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'fonts') return [];
      return walk(full, htmlOnly);
    }
    const extension = path.extname(entry.name);
    if (htmlOnly) return extension === '.html' ? [full] : [];
    return TEXT_EXTENSIONS.has(extension) ? [full] : [];
  }));
  return nested.flat();
}

async function scannedCharacters(): Promise<number[]> {
  const sources = await walk(path.join(appDir, 'src'), false);
  const pages = await walk(path.join(appDir, 'dist'), true);
  const texts = await Promise.all([...sources, ...pages].map((file) => readFile(file, 'utf8')));
  return collectCharacters(texts);
}

function assertFallback(css: string, metrics: VerticalMetrics): void {
  const overrides = verticalOverrides(metrics);
  const expected = [
    ['ascent-override', overrides.ascent],
    ['descent-override', overrides.descent],
    ['line-gap-override', overrides.lineGap],
  ] as const;
  for (const [name, value] of expected) {
    const hits = css.split(`${name}: ${value}`).length - 1;
    if (hits < 2) {
      throw new Error(`${name}: ${value} appears ${hits} times in fonts.css; both fallback faces must match the source font`);
    }
  }
}

async function subsetWeight(weight: FontWeight, text: string, requested: readonly number[]): Promise<Buffer> {
  const inputPath = sourcePath(weight);
  const sourceStat = await stat(inputPath);
  const key = createHash('sha256')
    .update(`${weight}\0${sourceStat.size}\0${sourceStat.mtimeMs}\0${text}`)
    .digest('hex');
  const cacheDir = path.join(appDir, '.cache', 'noto-subset');
  const cachePath = path.join(cacheDir, `${key}.woff2`);
  let bytes: Buffer | undefined;
  try {
    bytes = asBuffer(await readFile(cachePath));
  } catch {
    bytes = undefined;
  }
  if (!bytes) {
    const source = await readFile(inputPath);
    bytes = asBuffer(await subsetFont(source, text, { targetFormat: 'woff2' }));
  }

  if (bytes.byteLength < 8000 || bytes.byteLength > 600000) {
    throw new Error(`weight ${weight} subset is ${bytes.byteLength} bytes`);
  }

  const subsetCodes = codesInFont(asBuffer(await convert(bytes, 'sfnt')));
  const sourceCodes = codesInFont(asBuffer(await convert(await readFile(inputPath), 'sfnt')));
  const missing = requested.filter((code) => sourceCodes.has(code) && !subsetCodes.has(code));
  if (missing.length > 0) {
    const sample = missing.slice(0, 12).map((code) => `U+${code.toString(16).toUpperCase()}`).join(', ');
    throw new Error(`weight ${weight} dropped ${missing.length} glyphs that the source font has (${sample})`);
  }

  await mkdir(cacheDir, { recursive: true });
  await writeFile(cachePath, bytes);

  process.stdout.write(`${JSON.stringify({
    weight,
    bytes: bytes.byteLength,
    glyphs: subsetCodes.size,
    requested: requested.length,
  })}\n`);
  return bytes;
}

function outputDir(argv: readonly string[]): string {
  const flag = argv.indexOf('--out');
  if (flag === -1) return path.join(appDir, 'dist', 'fonts');
  const value = argv[flag + 1];
  if (!value) throw new Error('--out needs a directory');
  return path.resolve(value);
}

export async function writeSubset(outDir: string): Promise<void> {
  const requested = await scannedCharacters();
  const text = charactersToText(requested);
  const metrics = readVerticalMetrics(asBuffer(await convert(await readFile(sourcePath(400)), 'sfnt')));
  assertFallback(await readFile(path.join(appDir, 'src', 'styles', 'fonts.css'), 'utf8'), metrics);

  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });

  const faces: FaceFile[] = [];
  const ranges: number[][] = [];
  for (const weight of WEIGHTS) {
    const bytes = await subsetWeight(weight, text, requested);
    const codes = [...codesInFont(asBuffer(await convert(bytes, 'sfnt')))].toSorted((left, right) => left - right);
    ranges.push(codes);
    const hash = createHash('sha256').update(bytes).digest('hex').slice(0, 8);
    const filename = `noto-sans-jp-${weight}-${hash}.woff2`;
    await writeFile(path.join(outDir, filename), bytes);
    faces.push({ weight, href: `/fonts/${filename}` });
  }

  const first = ranges[0] ?? [];
  const shared = first.filter((code) => ranges.every((range) => range.includes(code)));
  await writeFile(path.join(outDir, STYLESHEET_NAME), fontFaceCss(faces, unicodeRange(shared)));
}

if (import.meta.main) {
  await writeSubset(outputDir(process.argv));
}
