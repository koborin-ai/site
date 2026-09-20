import { describe, test as it, after } from 'node:test';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { expect } from './test-utils.js';
import { checkCommand } from '../src/cli/commands/check.js';

describe('CLI check command', () => {
  const originalApiKey = process.env.TYPESAFE_AI_API_KEY;
  const originalTypesafeKey = process.env.TYPESAFE_API_KEY;

  after(() => {
    if (originalApiKey === undefined) {
      delete process.env.TYPESAFE_AI_API_KEY;
    } else {
      process.env.TYPESAFE_AI_API_KEY = originalApiKey;
    }
    if (originalTypesafeKey === undefined) {
      delete process.env.TYPESAFE_API_KEY;
    } else {
      process.env.TYPESAFE_API_KEY = originalTypesafeKey;
    }
  });

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

  it('returns exit code 2 when API key is missing and mock mode is not enabled', async () => {
    delete process.env.TYPESAFE_AI_API_KEY;
    delete process.env.TYPESAFE_API_KEY;

    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'jev-spec-cli-no-key-'));
    const configPath = path.join(tempDir, 'jev-spec.config.ts');
    await fs.writeFile(
      configPath,
      `export default {
  zones: {
    auth: {
      specPath: 'test/fixtures/specs/auth-requirements.md',
      codePaths: ['test/fixtures/src/auth.ts'],
      rubrics: {},
      assertions: {},
    },
  },
};`,
      'utf-8'
    );

    const exitCode = await checkCommand({
      cwd: path.resolve(new URL('.', import.meta.url).pathname, '../..'),
      config: configPath,
      format: 'json',
    });

    expect(exitCode).toBe(2);
  });
});
