import { spawnSync } from 'node:child_process';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { auditWorkflows } from './workflow-policy.ts';

const script = fileURLToPath(new URL('./workflow-policy.ts', import.meta.url));
const workflowDir = new URL('../../.github/workflows/', import.meta.url);

type Source = { readonly name: string; readonly source: string };

async function realWorkflows(): Promise<Source[]> {
  const names = (await readdir(workflowDir)).filter((name) => name.endsWith('.yml'));
  return Promise.all(names.map(async (name) => ({ name, source: await readFile(new URL(name, workflowDir), 'utf8') })));
}

async function edited(name: string, from: string, to: string): Promise<Source[]> {
  return (await realWorkflows()).map((file) => {
    if (file.name !== name) return file;
    if (!file.source.includes(from)) throw new Error(`${name} does not contain ${JSON.stringify(from)}`);
    return { name, source: file.source.replace(from, to) };
  });
}

function only(file: string, rule: string) {
  return [expect.objectContaining({ file, rule })];
}

const checkoutPin = 'actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1';

describe('auditWorkflows', () => {
  it('passes the workflows in this repository', async () => {
    expect(auditWorkflows(await realWorkflows())).toEqual([]);
  });

  it.each([
    ['a major tag', 'actions/checkout@v7'],
    ['a sha without its version comment', 'actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1'],
  ])('rejects an external action pinned to %s', async (_label, uses) => {
    expect(auditWorkflows(await edited('app-ci.yml', checkoutPin, uses))).toEqual(only('app-ci.yml', 'pin'));
  });

  it.each(['release-infra.yml', 'plan-infra.yml', 'app-release.yml'])(
    'rejects cancel-in-progress true on the production group in %s',
    async (name) => {
      const files = await edited(name, 'cancel-in-progress: false', 'cancel-in-progress: true');
      expect(auditWorkflows(files)).toEqual(only(name, 'concurrency'));
    },
  );

  it('rejects a pull request workflow that does not cancel superseded runs', async () => {
    const files = await edited('required-checks.yml', 'cancel-in-progress: true', 'cancel-in-progress: false');
    expect(auditWorkflows(files)).toEqual(only('required-checks.yml', 'concurrency'));
  });

  it('rejects a job without its own permissions block', async () => {
    const files = await edited(
      'app-ci.yml',
      '    permissions:\n      contents: read\n    timeout-minutes:',
      '    timeout-minutes:',
    );
    expect(auditWorkflows(files)).toEqual(only('app-ci.yml', 'permission'));
  });

  it('rejects pull-requests write on a job other than the label job', async () => {
    const files = await edited(
      'required-checks.yml',
      '    permissions:\n      contents: read\n    timeout-minutes: 5\n    outputs:',
      '    permissions:\n      contents: read\n      pull-requests: write\n    timeout-minutes: 5\n    outputs:',
    );
    expect(auditWorkflows(files)).toEqual(only('required-checks.yml', 'permission'));
  });

  it('rejects a label job that runs on forks', async () => {
    const files = await edited(
      'label-pr.yml',
      '    if: github.event.pull_request.head.repo.full_name == github.repository\n',
      '',
    );
    expect(auditWorkflows(files)).toEqual(only('label-pr.yml', 'fork'));
  });

  it('rejects continue-on-error', async () => {
    const files = await edited(
      'app-ci.yml',
      '      - name: Build\n',
      '      - name: Build\n        continue-on-error: true\n',
    );
    expect(auditWorkflows(files)).toEqual(only('app-ci.yml', 'snippet'));
  });

  it('rejects a ninth workflow file and a rule whose file is gone', async () => {
    const files = await realWorkflows();
    const ninth = { name: 'lighthouse.yml', source: files.find((file) => file.name === 'app-ci.yml')?.source ?? '' };

    expect(auditWorkflows([...files, ninth])).toEqual(only('lighthouse.yml', 'unclassified'));
    expect(auditWorkflows(files.filter((file) => file.name !== 'smoke-prod.yml'))).toEqual(
      only('smoke-prod.yml', 'unclassified'),
    );
  });
});

describe('workflow-policy cli', () => {
  it('exits 0 on the real workflow directory', () => {
    const result = spawnSync(process.execPath, [script], { encoding: 'utf8' });
    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
    expect(result.stdout).toBe('workflows 8\nviolations 0\n');
  });

  it('imports only node: built-ins, because automation CI runs it without npm ci', async () => {
    const source = await readFile(script, 'utf8');
    const specifiers = [...source.matchAll(/\bfrom\s+['"]([^'"]+)['"]|\bimport\s*\(?\s*['"]([^'"]+)['"]/g)].map(
      (match) => match[1] ?? match[2],
    );
    expect(specifiers.length).toBeGreaterThan(0);
    expect(specifiers.filter((specifier) => !specifier?.startsWith('node:'))).toEqual([]);
  });
});
