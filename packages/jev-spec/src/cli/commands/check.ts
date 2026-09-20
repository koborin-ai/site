import * as fs from 'node:fs/promises';
import { loadConfig } from '../../config.js';
import { runVerification } from '../../runner/engine.js';
import { formatTerminalReport, formatMarkdownReport } from '../../runner/reporter.js';

export interface CheckCliOptions {
  readonly config?: string;
  readonly zone?: string;
  readonly format?: 'terminal' | 'markdown' | 'json';
  readonly output?: string;
  readonly staged?: boolean;
  readonly diff?: string | boolean;
  readonly cwd?: string;
}

export class JevSpecCliError extends Error {
  constructor(
    message: string,
    readonly exitCode: 2 | 1 = 2
  ) {
    super(message);
    this.name = 'JevSpecCliError';
  }
}

function resolveGitDiffOptions(options: CheckCliOptions) {
  if (options.staged) {
    return { staged: true as const };
  }
  if (options.diff !== undefined) {
    if (options.diff === true || options.diff === '') {
      return { diffRange: 'HEAD' };
    }
    return { diffRange: String(options.diff) };
  }
  return undefined;
}

export async function checkCommand(options: CheckCliOptions = {}): Promise<number> {
  try {
    const config = await loadConfig(options.config, options.cwd);
    const result = await runVerification(config, {
      cwd: options.cwd,
      zone: options.zone,
      gitDiff: resolveGitDiffOptions(options),
    });

    const format = options.format ?? 'terminal';
    let outputText: string;

    if (format === 'json') {
      outputText = JSON.stringify(result, null, 2);
    } else if (format === 'markdown') {
      outputText = formatMarkdownReport(result);
    } else {
      outputText = formatTerminalReport(result);
    }

    if (options.output) {
      await fs.writeFile(options.output, `${outputText}\n`, 'utf-8');
    } else {
      console.log(outputText);
    }

    return result.passed ? 0 : 1;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`\n[jev-spec error] ${message}`);
    if (error instanceof JevSpecCliError) {
      return error.exitCode;
    }
    return 2;
  }
}
