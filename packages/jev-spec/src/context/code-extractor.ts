import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { CodeExtractionOptions } from './types.js';
import { resolveGlobPatterns, matchesGlobPatterns } from './glob-matcher.js';
import { extractGitDiff, formatDiffContext } from './git-diff.js';

export interface CodeFileContext {
  readonly relativePath: string;
  readonly absolutePath: string;
  readonly content: string;
  readonly lineCount: number;
  readonly source: 'file' | 'diff';
}

export interface ExtractedCodeContext {
  readonly files: readonly CodeFileContext[];
  readonly combinedPromptContext: string;
  readonly totalLines: number;
  readonly mode: 'full' | 'diff';
}

const DEFAULT_MAX_CHARS = 120_000;

/**
 * Resolves paths and extracts code content from files or git diffs.
 */
export async function extractCodeContext(
  filePatterns: readonly string[],
  options: CodeExtractionOptions = {}
): Promise<ExtractedCodeContext> {
  const cwd = options.cwd ?? process.cwd();
  const maxChars = options.maxTotalChars ?? DEFAULT_MAX_CHARS;

  if (options.gitDiff?.staged || options.gitDiff?.diffRange) {
    return extractFromGitDiff(filePatterns, cwd, options, maxChars);
  }

  const resolvedPaths = await resolveGlobPatterns(filePatterns, cwd);
  const files: CodeFileContext[] = [];

  for (const relPath of resolvedPaths) {
    const absolutePath = path.resolve(cwd, relPath);
    try {
      const content = await fs.readFile(absolutePath, 'utf-8');
      const lines = content.split('\n');
      files.push({
        relativePath: relPath,
        absolutePath,
        content,
        lineCount: lines.length,
        source: 'file',
      });
    } catch {
      // Skip unreadable paths
    }
  }

  return buildExtractedContext(files, 'full', maxChars);
}

async function extractFromGitDiff(
  filePatterns: readonly string[],
  cwd: string,
  options: CodeExtractionOptions,
  maxChars: number
): Promise<ExtractedCodeContext> {
  const diff = await extractGitDiff(options.gitDiff!, cwd, options.contextLines);
  const matched = diff.files.filter((file) => matchesGlobPatterns(file.relativePath, filePatterns));

  const files: CodeFileContext[] = matched.map((file) => ({
    relativePath: file.relativePath,
    absolutePath: path.resolve(cwd, file.relativePath),
    content: file.formattedDiff,
    lineCount: file.hunks.reduce((acc, hunk) => acc + hunk.lineCount, 0),
    source: 'diff' as const,
  }));

  if (files.length === 0 && diff.rawDiff.trim()) {
    return {
      files: [],
      combinedPromptContext: formatDiffContext([]),
      totalLines: 0,
      mode: 'diff',
    };
  }

  return buildExtractedContext(files, 'diff', maxChars, formatDiffContext(matched));
}

function buildExtractedContext(
  files: CodeFileContext[],
  mode: 'full' | 'diff',
  maxChars: number,
  diffFormatted?: string
): ExtractedCodeContext {
  let combinedPromptContext =
    mode === 'diff' && diffFormatted !== undefined
      ? diffFormatted
      : files
          .map((file) => `--- File: ${file.relativePath} ---\n${file.content}`)
          .join('\n\n');

  if (combinedPromptContext.length > maxChars) {
    combinedPromptContext = `${combinedPromptContext.slice(0, maxChars)}\n\n[... truncated for token budget ...]`;
  }

  const totalLines = files.reduce((acc, file) => acc + file.lineCount, 0);

  return {
    files,
    combinedPromptContext,
    totalLines,
    mode,
  };
}

/**
 * Backward-compatible helper for explicit file path lists.
 */
export async function extractCodeFromPaths(
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
        source: 'file',
      });
    } catch {
      // Skip unreadable paths
    }
  }

  return buildExtractedContext(files, 'full', DEFAULT_MAX_CHARS);
}
