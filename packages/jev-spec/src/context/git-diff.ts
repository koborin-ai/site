import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { GitDiffOptions, GitDiffResult, ParsedDiffFile, ParsedDiffHunk } from './types.js';

const execFileAsync = promisify(execFile);

const DEFAULT_CONTEXT_LINES = 3;

/**
 * Runs git diff and returns parsed file hunks.
 */
export async function extractGitDiff(
  options: GitDiffOptions,
  cwd: string = process.cwd(),
  contextLines: number = DEFAULT_CONTEXT_LINES
): Promise<GitDiffResult> {
  const args = ['diff', `--unified=${contextLines}`];

  if (options.staged) {
    args.push('--staged');
  } else if (options.diffRange) {
    args.push(options.diffRange);
  }

  let stdout = '';
  try {
    const result = await execFileAsync('git', args, {
      cwd,
      maxBuffer: 10 * 1024 * 1024,
      encoding: 'utf-8',
    });
    stdout = result.stdout ?? '';
  } catch (error: unknown) {
    const execError = error as { stdout?: string; stderr?: string; message?: string };
    if (execError.stdout) {
      stdout = execError.stdout;
    } else {
      throw new Error(`Failed to run git diff: ${execError.message ?? String(error)}`);
    }
  }

  const files = parseUnifiedDiff(stdout);
  return {
    files,
    rawDiff: stdout,
    changedPaths: files.map((file) => file.relativePath),
  };
}

/**
 * Parses unified diff output into structured file entries.
 */
export function parseUnifiedDiff(rawDiff: string): ParsedDiffFile[] {
  if (!rawDiff.trim()) {
    return [];
  }

  const files: ParsedDiffFile[] = [];
  const chunks = rawDiff.split(/^diff --git /m).filter(Boolean);

  for (const chunk of chunks) {
    const lines = chunk.split('\n');
    const header = lines[0] ?? '';
    const pathMatch = header.match(/^a\/(.+?) b\/(.+)$/);
    if (!pathMatch) {
      continue;
    }

    const relativePath = pathMatch[2];
    let status: ParsedDiffFile['status'] = 'modified';
    if (lines.some((line) => line.startsWith('new file mode'))) {
      status = 'added';
    } else if (lines.some((line) => line.startsWith('deleted file mode'))) {
      status = 'deleted';
    } else if (lines.some((line) => line.startsWith('rename from'))) {
      status = 'renamed';
    }

    const hunks: ParsedDiffHunk[] = [];
    let currentHunk: ParsedDiffHunk | null = null;

    for (const line of lines) {
      const hunkMatch = line.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      if (hunkMatch) {
        if (currentHunk) {
          hunks.push(currentHunk);
        }
        currentHunk = {
          startLine: Number.parseInt(hunkMatch[2], 10),
          lineCount: 0,
          content: line,
        };
        continue;
      }

      if (currentHunk && (line.startsWith('+') || line.startsWith('-') || line.startsWith(' '))) {
        currentHunk = {
          ...currentHunk,
          lineCount: currentHunk.lineCount + 1,
          content: `${currentHunk.content}\n${line}`,
        };
      }
    }

    if (currentHunk) {
      hunks.push(currentHunk);
    }

    files.push({
      relativePath,
      status,
      hunks,
      formattedDiff: `diff --git ${chunk}`.trimEnd(),
    });
  }

  return files;
}

/**
 * Formats parsed diff files into prompt-friendly context.
 */
export function formatDiffContext(files: readonly ParsedDiffFile[]): string {
  if (files.length === 0) {
    return '(no matching diff hunks)';
  }

  return files
    .map((file) => {
      const header = `--- Diff: ${file.relativePath} (${file.status}) ---`;
      const body = file.formattedDiff.replace(/^diff --git /, '');
      return `${header}\n${body}`;
    })
    .join('\n\n');
}
