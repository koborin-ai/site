import fg from 'fast-glob';
import micromatch from 'micromatch';
import * as path from 'node:path';

/**
 * Resolves include/ignore glob patterns into relative file paths.
 */
export async function resolveGlobPatterns(
  patterns: readonly string[],
  cwd: string = process.cwd()
): Promise<string[]> {
  const include: string[] = [];
  const ignore: string[] = [];

  for (const pattern of patterns) {
    if (pattern.startsWith('!')) {
      ignore.push(pattern.slice(1));
    } else {
      include.push(pattern);
    }
  }

  if (include.length === 0) {
    return [];
  }

  const matches = await fg(include, {
    cwd,
    ignore,
    onlyFiles: true,
    dot: false,
    unique: true,
  });

  return matches.sort();
}

/**
 * Returns true when a relative path matches any include pattern and no ignore pattern.
 */
export function matchesGlobPatterns(relativePath: string, patterns: readonly string[]): boolean {
  const normalized = relativePath.split(path.sep).join('/');
  const include = patterns.filter((p) => !p.startsWith('!'));
  const ignore = patterns.filter((p) => p.startsWith('!')).map((p) => p.slice(1));

  const included =
    include.length === 0 ||
    include.some((pattern) => micromatch.isMatch(normalized, pattern));
  const excluded = ignore.some((pattern) => micromatch.isMatch(normalized, pattern));

  return included && !excluded;
}
