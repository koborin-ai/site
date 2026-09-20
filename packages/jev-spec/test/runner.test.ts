import { describe, test as it } from 'node:test';
import { fileURLToPath } from 'node:url';
import * as path from 'node:path';
import { expect } from './test-utils.js';
import { runVerification } from '../src/runner/engine.js';
import { formatTerminalReport, formatMarkdownReport } from '../src/runner/reporter.js';
import { MockJevEvaluator } from '../src/evaluator/jev-evaluator.js';
import sampleConfig from './fixtures/sample.config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('jev-spec Runner & Engine', () => {
  it('runs end-to-end verification with mock evaluator on sample config', async () => {
    // Resolve relative to package root
    const pkgRoot = path.resolve(__dirname, '../..');
    const result = await runVerification(sampleConfig, {
      cwd: pkgRoot,
      evaluator: new MockJevEvaluator(),
    });

    expect(result.passed).toBe(true);
    expect(result.zones).toHaveLength(1);

    const authZone = result.zones[0];
    expect(authZone.zoneName).toBe('auth');
    expect(authZone.passed).toBe(true);
    expect(authZone.evaluations).toHaveLength(4);

    // Verify terminal and markdown report generation
    const terminalReport = formatTerminalReport(result);
    expect(terminalReport).toContain('Zone: auth');
    expect(terminalReport).toContain('ALL CHECKS PASSED');

    const mdReport = formatMarkdownReport(result);
    expect(mdReport).toContain('jev-spec` Verification Summary');
    expect(mdReport).toContain('| `auth` | ✅ PASS |');
  });
});
