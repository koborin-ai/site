import * as fs from 'node:fs/promises';
import * as path from 'node:path';

export interface CodeFileContext {
  readonly relativePath: string;
  readonly absolutePath: string;
  readonly content: string;
  readonly lineCount: number;
}

export interface ExtractedCodeContext {
  readonly files: readonly CodeFileContext[];
  readonly combinedPromptContext: string;
  readonly totalLines: number;
}

/**
 * Resolves paths and extracts code content.
 */
export async function extractCodeContext(
  filePaths: readonly string[],
  cwd: string = process.cwd()
): Promise<ExtractedCodeContext> {
  const files: CodeFileContext[] = [];

  for (const relPath of filePaths) {
    const absolutePath = path.isAbsolute(relPath) ? relPath : path.resolve(cwd, relPath);
    try {
      const content = await fs.readFile(absolutePath, 'utf-8');
      const lines = content.split('\n');
      files.push({
        relativePath: path.relative(cwd, absolutePath),
        absolutePath,
        content,
        lineCount: lines.length,
      });
    } catch {
      // File could not be read or does not exist
    }
  }

  const combinedPromptContext = files
    .map((file) => `--- File: ${file.relativePath} ---\n${file.content}`)
    .join('\n\n');

  const totalLines = files.reduce((acc, f) => acc + f.lineCount, 0);

  return {
    files,
    combinedPromptContext,
    totalLines,
  };
}
