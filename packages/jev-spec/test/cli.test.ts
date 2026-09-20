import { describe, test as it } from 'node:test';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { expect } from './test-utils.js';
import { checkCommand } from '../src/cli/commands/check.js';

describe('CLI check command', () => {
  it('returns exit code 2 for missing configuration', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'jev-spec-cli-'));
    const exitCode = await checkCommand({ cwd: tempDir, format: 'json' });
    expect(exitCode).toBe(2);
  });

  it('writes json output to a file when --output is set', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'jev-spec-cli-out-'));
    const outputPath = path.join(tempDir, 'result.json');
    const exitCode = await checkCommand({
      cwd: path.resolve(new URL('.', import.meta.url).pathname, '../..'),
      config: 'test/fixtures/sample.config.ts',
      format: 'json',
      output: outputPath,
    });

    expect(exitCode).toBe(0);
    const written = await fs.readFile(outputPath, 'utf-8');
    expect(written).toContain('"passed": true');
  });
});
