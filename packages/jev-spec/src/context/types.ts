export interface GitDiffOptions {
  readonly staged?: boolean;
  readonly diffRange?: string;
}

export interface ParsedDiffHunk {
  readonly startLine: number;
  readonly lineCount: number;
  readonly content: string;
}

export interface ParsedDiffFile {
  readonly relativePath: string;
  readonly status: 'modified' | 'added' | 'deleted' | 'renamed';
  readonly hunks: readonly ParsedDiffHunk[];
  readonly formattedDiff: string;
}

export interface GitDiffResult {
  readonly files: readonly ParsedDiffFile[];
  readonly rawDiff: string;
  readonly changedPaths: readonly string[];
}

export interface CodeExtractionOptions {
  readonly cwd?: string;
  readonly gitDiff?: GitDiffOptions;
  readonly contextLines?: number;
  readonly maxTotalChars?: number;
}
