import { loadConfig } from '../../config.js';
import { runVerification } from '../../runner/engine.js';
import { formatTerminalReport, formatMarkdownReport } from '../../runner/reporter.js';

export interface CheckCliOptions {
  readonly config?: string;
  readonly zone?: string;
  readonly format?: 'terminal' | 'markdown' | 'json';
  readonly cwd?: string;
}

export async function checkCommand(options: CheckCliOptions = {}): Promise<number> {
  try {
    const config = await loadConfig(options.config, options.cwd);
    const result = await runVerification(config, {
      cwd: options.cwd,
      zone: options.zone,
    });

    const format = options.format ?? 'terminal';

    if (format === 'json') {
      console.log(JSON.stringify(result, null, 2));
    } else if (format === 'markdown') {
      console.log(formatMarkdownReport(result));
    } else {
      console.log(formatTerminalReport(result));
    }

    return result.passed ? 0 : 1;
  } catch (error: any) {
    console.error(`\n[jev-spec error] ${error?.message || error}`);
    return 1;
  }
}
