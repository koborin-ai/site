import { readFile, rename, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const STATIC_OG_QUALITY = 85;
const OUTPUT_WIDTH = 1200;

export class MissingOgFile extends Error {
  override readonly name = 'MissingOgFile';
  readonly file: string;
  readonly role: 'input' | 'output';

  constructor(file: string, role: 'input' | 'output', reason: string) {
    super(`OG ${role} ${file}: ${reason}`);
    this.file = file;
    this.role = role;
  }
}

type StaticOgJob =
  | {
      readonly source: 'index.png';
      readonly output: 'index.webp';
      readonly sourceWidth: 1200;
      readonly resizeWidth: null;
    }
  | {
      readonly source: 'koborin-ai-hero.png';
      readonly output: 'koborin-ai-hero.webp';
      readonly sourceWidth: 1376;
      readonly resizeWidth: typeof OUTPUT_WIDTH;
    };

const staticOgJobs: readonly StaticOgJob[] = [
  { source: 'index.png', output: 'index.webp', sourceWidth: 1200, resizeWidth: null },
  { source: 'koborin-ai-hero.png', output: 'koborin-ai-hero.webp', sourceWidth: 1376, resizeWidth: OUTPUT_WIDTH },
];

export type WrittenOg = {
  readonly file: StaticOgJob['output'];
  readonly width: typeof OUTPUT_WIDTH;
  readonly bytes: number;
};

async function readSource(ogDir: string, job: StaticOgJob): Promise<Buffer> {
  const bytes = await readFile(path.join(ogDir, job.source)).catch((error: NodeJS.ErrnoException) => {
    throw error.code === 'ENOENT' ? new MissingOgFile(job.source, 'input', 'not found') : error;
  });
  const { width } = await sharp(bytes).metadata();
  if (width !== job.sourceWidth) {
    throw new MissingOgFile(job.source, 'input', `width ${width}, expected ${job.sourceWidth}`);
  }
  return bytes;
}

async function encode(ogDir: string, job: StaticOgJob, source: Buffer): Promise<WrittenOg> {
  const partial = path.join(ogDir, `${job.output}.partial`);
  const image = job.resizeWidth === null ? sharp(source) : sharp(source).resize({ width: job.resizeWidth });
  await image.webp({ quality: STATIC_OG_QUALITY }).toFile(partial);

  const { size } = await stat(partial).catch(() => ({ size: 0 }));
  if (size === 0) throw new MissingOgFile(job.output, 'output', 'empty or not written');
  const { width } = await sharp(partial).metadata();
  if (width !== OUTPUT_WIDTH) {
    throw new MissingOgFile(job.output, 'output', `width ${width}, expected ${OUTPUT_WIDTH}`);
  }

  await rename(partial, path.join(ogDir, job.output));
  return { file: job.output, width: OUTPUT_WIDTH, bytes: size };
}

/** Every source is read and checked before the first write, so a bad input leaves no new webp. */
export async function renderStaticOg(ogDir: string): Promise<readonly WrittenOg[]> {
  await Promise.all(staticOgJobs.map((job) => rm(path.join(ogDir, `${job.output}.partial`), { force: true })));
  const sources = await Promise.all(
    staticOgJobs.map(async (job) => ({ job, bytes: await readSource(ogDir, job) })),
  );
  const written: WrittenOg[] = [];
  for (const { job, bytes } of sources) {
    written.push(await encode(ogDir, job, bytes));
  }
  return written;
}

if (import.meta.main) {
  const ogDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'og');
  for (const og of await renderStaticOg(ogDir)) {
    process.stdout.write(`og ${og.file} ${og.width}w ${og.bytes} bytes\n`);
  }
}
