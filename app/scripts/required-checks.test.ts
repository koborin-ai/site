import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { areas, changedAreas, judgeGate } from './required-checks.ts';
import type { Area, JobResult } from './required-checks.ts';

const script = fileURLToPath(new URL('./required-checks.ts', import.meta.url));

function workflow(name: string): Promise<string> {
  return readFile(new URL(`../../.github/workflows/${name}`, import.meta.url), 'utf8');
}

function runCli(args: readonly string[], options: { input?: string; env?: Record<string, string> } = {}) {
  const env = { ...process.env, ...options.env };
  if (!options.env || !('NEEDS' in options.env)) delete env.NEEDS;
  return spawnSync(process.execPath, [script, ...args], { encoding: 'utf8', input: options.input ?? '', env });
}

function changes(touched: readonly Area[]) {
  return { result: 'success', outputs: { areas: JSON.stringify(touched) } };
}

const skipped = { result: 'skipped', outputs: {} };

describe('changedAreas', () => {
  it.each<[string, Area[]]>([
    ['app/src/pages/index.astro', ['app']],
    ['app/.oxlintrc.json', ['app']],
    ['app/src/content/docs/tech/foo.mdx', ['app']],
    ['content/future.md', ['app', 'automation']],
    ['app/scripts/smoke-prod.ts', ['app', 'automation']],
    ['infra/lib/site_stack.dart', ['infra']],
    ['infra/app/x.dart', ['infra']],
    ['.tool-versions', ['app', 'infra', 'automation']],
    ['mise.toml', ['app', 'infra', 'automation']],
    ['.github/workflows/required-checks.yml', ['app', 'infra', 'automation']],
    ['.github/workflows/app-ci.yml', ['app', 'automation']],
    ['.github/workflows/app-release.yml', ['app', 'automation']],
    ['.github/workflows/plan-infra.yml', ['infra', 'automation']],
    ['.github/workflows/release-infra.yml', ['automation']],
    ['.github/scripts/compute-pr-labels.sh', ['automation']],
    ['.github/actionlint.yaml', ['automation']],
    ['.github/pull_request_template.md', ['automation']],
    ['.markdownlint.yaml', ['automation']],
    ['README.md', ['automation']],
    ['.gitignore', []],
    ['.github/dependabot.yml', []],
    ['application/x.ts', []],
  ])('%s selects %j', (file, expected) => {
    expect(changedAreas([file])).toEqual(expected);
  });

  it('unions the areas of every changed file', () => {
    expect(changedAreas(['README.md', 'infra/bin/infra.dart'])).toEqual(['infra', 'automation']);
  });

  it('selects nothing for an empty change list', () => {
    expect(changedAreas([])).toEqual([]);
  });
});

describe('judgeGate pass table', () => {
  it.each<[JobResult, boolean, boolean]>([
    ['success', true, true],
    ['success', false, true],
    ['skipped', true, false],
    ['skipped', false, true],
    ['absent', true, false],
    ['absent', false, true],
    ['failure', true, false],
    ['failure', false, false],
    ['cancelled', true, false],
    ['cancelled', false, false],
  ])('app %s with required=%s passes=%s', (result, required, pass) => {
    const needs: Record<string, unknown> = {
      changes: changes(required ? ['app'] : []),
      infra: skipped,
      automation: skipped,
    };
    if (result !== 'absent') needs.app = { result, outputs: {} };

    const report = judgeGate(needs);

    expect(report.pass).toBe(pass);
    expect(report.rows.find((entry) => entry.job === 'app')).toMatchObject({ required, result, pass });
  });
});

describe('judgeGate on needs payloads', () => {
  it('passes when nothing changed and every area skipped', () => {
    expect(judgeGate({ changes: changes([]), app: skipped, infra: skipped, automation: skipped }).pass).toBe(true);
  });

  it('passes when every changed area succeeded and the rest skipped', () => {
    const report = judgeGate({
      changes: changes(['infra', 'automation']),
      app: skipped,
      infra: { result: 'success', outputs: {} },
      automation: { result: 'success', outputs: {} },
    });
    expect(report.pass).toBe(true);
    expect(report.rows.map((entry) => [entry.job, entry.required])).toEqual([
      ['changes', true],
      ['app', false],
      ['infra', true],
      ['automation', true],
    ]);
  });

  it('fails and requires every area when the changes job failed', () => {
    const report = judgeGate({
      changes: { result: 'failure', outputs: {} },
      app: skipped,
      infra: skipped,
      automation: skipped,
    });
    expect(report.pass).toBe(false);
    expect(report.rows.every((entry) => entry.required)).toBe(true);
  });

  it.each([
    ['not JSON', 'app'],
    ['not an array', '{"app":true}'],
    ['an unknown area', '["app","docs"]'],
    ['missing', undefined],
  ])('fails and requires every area when the areas output is %s', (_label, output) => {
    const report = judgeGate({
      changes: { result: 'success', outputs: output === undefined ? {} : { areas: output } },
      app: { result: 'success', outputs: {} },
      infra: skipped,
      automation: skipped,
    });
    expect(report.pass).toBe(false);
    expect(report.rows.find((entry) => entry.job === 'changes')?.pass).toBe(false);
    expect(report.rows.filter((entry) => entry.job !== 'changes').every((entry) => entry.required)).toBe(true);
  });

  it('fails when the changes job is missing', () => {
    expect(judgeGate({ app: skipped, infra: skipped, automation: skipped }).pass).toBe(false);
  });

  it('fails when a changed area is missing from needs', () => {
    expect(judgeGate({ changes: changes(['infra']), app: skipped, automation: skipped }).pass).toBe(false);
  });

  it('treats an unknown result string as a failure, even on an unchanged area', () => {
    const report = judgeGate({
      changes: changes([]),
      app: { result: 'neutral', outputs: {} },
      infra: skipped,
      automation: skipped,
    });
    expect(report.pass).toBe(false);
    expect(report.rows.find((entry) => entry.job === 'app')?.result).toBe('failure');
  });

  it.each([null, undefined, [], 'needs'])('fails when needs is %j', (needs) => {
    expect(judgeGate(needs).pass).toBe(false);
  });
});

describe('required-checks cli', () => {
  it('prints the changed areas from NUL-separated paths as a GITHUB_OUTPUT line', () => {
    const result = runCli(['areas'], { input: 'app/src/x.ts\0README.md\0' });
    expect(result.status).toBe(0);
    expect(result.stdout).toBe('areas=["app","automation"]\n');
  });

  it('prints an empty list when nothing matches', () => {
    const result = runCli(['areas'], { input: '.gitignore\0' });
    expect(result.status).toBe(0);
    expect(result.stdout).toBe('areas=[]\n');
  });

  it('exits 1 and prints the table when a changed area failed', () => {
    const needs = {
      changes: changes(['app']),
      app: { result: 'failure', outputs: {} },
      infra: skipped,
      automation: skipped,
    };
    const result = runCli(['verdict'], { env: { NEEDS: JSON.stringify(needs) } });
    expect(result.status).toBe(1);
    expect(result.stdout).toContain('| app | yes | failure | fail |');
  });

  it('exits 0 when every changed area passed', () => {
    const needs = {
      changes: changes(['app']),
      app: { result: 'success', outputs: {} },
      infra: skipped,
      automation: skipped,
    };
    const result = runCli(['verdict'], { env: { NEEDS: JSON.stringify(needs) } });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('| changes | yes | success | pass |');
  });

  it.each([
    ['unset', undefined],
    ['not JSON', '{'],
  ])('exits 1 when NEEDS is %s', (_label, raw) => {
    const result = runCli(['verdict'], raw === undefined ? {} : { env: { NEEDS: raw } });
    expect(result.status).toBe(1);
  });

  it('exits 2 on an unknown command', () => {
    expect(runCli(['nope']).status).toBe(2);
  });
});

describe('workflow wiring', () => {
  it.each(['required-checks.yml', 'app-ci.yml', 'automation-ci.yml', 'plan-infra.yml'])(
    '%s has no paths filter, so required-checks reports on every pull request',
    async (name) => {
      expect(await workflow(name)).not.toMatch(/^\s*paths(-ignore)?:/m);
    },
  );

  it('runs one job per area on the changes output, and the gate needs every one', async () => {
    const source = await workflow('required-checks.yml');
    for (const area of areas) {
      expect(source).toContain(
        `  ${area}:\n    needs: changes\n    if: contains(fromJSON(needs.changes.outputs.areas), '${area}')\n`,
      );
    }
    expect(source).toContain(`needs: [changes, ${areas.join(', ')}]`);
  });

  it.each(['release-infra.yml', 'app-release.yml'])('%s deploys only from main', async (name) => {
    expect(await workflow(name)).toMatch(/^ {4}if: github\.ref == 'refs\/heads\/main'$/m);
  });

  it('release-infra.yml has no infra-v tag trigger', async () => {
    expect(await workflow('release-infra.yml')).not.toContain('infra-v');
  });
});

describe('required-checks module', () => {
  it('imports only node: built-ins, because required-checks.yml runs it before npm ci', async () => {
    const source = await readFile(script, 'utf8');
    const specifiers = [...source.matchAll(/\bfrom\s+['"]([^'"]+)['"]|\bimport\s*\(?\s*['"]([^'"]+)['"]/g)].map(
      (match) => match[1] ?? match[2],
    );
    expect(specifiers.length).toBeGreaterThan(0);
    expect(specifiers.filter((specifier) => !specifier?.startsWith('node:'))).toEqual([]);
  });
});
