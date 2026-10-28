import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { ICONS, renderIcon } from '../src/lib/icons.ts';

const publicDir = path.resolve(import.meta.dirname, '../public');

for (const icon of ICONS) {
  const { bytes } = await renderIcon(icon);
  await writeFile(path.join(publicDir, icon.file), bytes);
}
