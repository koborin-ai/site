import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

type ConcurrencyRule =
  | { readonly mode: 'cancel-superseded'; readonly prefix: 'pull-request' | 'label-pr' }
  | { readonly mode: 'never-cancel'; readonly group: 'app-release' | 'terraform-state'; readonly at: 'workflow' }
  | { readonly mode: 'never-cancel'; readonly group: 'terraform-state'; readonly at: 'job'; readonly job: 'plan' }
  | { readonly mode: 'none' };

type WorkflowName =
  | 'required-checks.yml'
  | 'label-pr.yml'
  | 'app-ci.yml'
  | 'automation-ci.yml'
  | 'plan-infra.yml'
  | 'app-release.yml'
  | 'release-infra.yml'
  | 'smoke-prod.yml';

type WorkflowRule = {
  readonly concurrency: ConcurrencyRule;
  /** The one job granted pull-requests write. It must skip forks, whose token is read-only. */
  readonly forkJob: 'label' | null;
};

const rules: Record<WorkflowName, WorkflowRule> = {
  'required-checks.yml': { concurrency: { mode: 'cancel-superseded', prefix: 'pull-request' }, forkJob: null },
  'label-pr.yml': { concurrency: { mode: 'cancel-superseded', prefix: 'label-pr' }, forkJob: 'label' },
  'app-ci.yml': { concurrency: { mode: 'none' }, forkJob: null },
  'automation-ci.yml': { concurrency: { mode: 'none' }, forkJob: null },
  'plan-infra.yml': {
    concurrency: { mode: 'never-cancel', group: 'terraform-state', at: 'job', job: 'plan' },
    forkJob: null,
  },
  'app-release.yml': { concurrency: { mode: 'never-cancel', group: 'app-release', at: 'workflow' }, forkJob: null },
  'release-infra.yml': {
    concurrency: { mode: 'never-cancel', group: 'terraform-state', at: 'workflow' },
    forkJob: null,
  },
  'smoke-prod.yml': { concurrency: { mode: 'none' }, forkJob: null },
};

const forkPredicate = 'github.event.pull_request.head.repo.full_name == github.repository';
const readOnly = { contents: 'read' } as const;
const forkJobScopes = { contents: 'read', 'pull-requests': 'write' } as const;
const pinnedUse = /^[\w.-]+\/[\w.-]+@[0-9a-f]{40} # v\d+\.\d+\.\d+$/;
const forbiddenKeys = /(?:^|[\s-])(continue-on-error|pull_request_target)\b/;

type WorkflowSource = { readonly name: string; readonly source: string };

export type PolicyViolation = {
  readonly file: string;
  readonly rule: 'pin' | 'permission' | 'concurrency' | 'fork' | 'unclassified' | 'snippet';
  readonly message: string;
};

type YamlNode = { readonly key: string; readonly value: string; readonly children: YamlNode[] };

/**
 * Reads the block-style subset these workflows use: `key: value`, nested mappings,
 * `- ` sequence items, and `|` or `>` block scalars. actionlint has already parsed the files.
 */
function leadingSpaces(line: string): number {
  return line.length - line.trimStart().length;
}

function parseYaml(source: string): YamlNode {
  const root: YamlNode = { key: '', value: '', children: [] };
  const open: { indent: number; node: YamlNode }[] = [{ indent: -1, node: root }];
  const add = (indent: number, node: YamlNode) => {
    open[open.length - 1].node.children.push(node);
    open.push({ indent, node });
  };
  const lines = source.split('\n');
  for (let index = 0; index < lines.length; index += 1) {
    let text = lines[index].trimStart();
    if (text === '' || text.startsWith('#')) continue;
    let indent = leadingSpaces(lines[index]);
    while (open[open.length - 1].indent >= indent) open.pop();

    if (text === '-' || text.startsWith('- ')) {
      add(indent, { key: '-', value: '', children: [] });
      const rest = text.slice(1).trimStart();
      indent += text.length - rest.length;
      text = rest;
      if (text === '') continue;
    }

    const entry = /^([^\s'"][^:]*):(?:\s+(.*))?$/.exec(text);
    if (entry === null) {
      add(indent, { key: '', value: text, children: [] });
      continue;
    }
    let value = entry[2]?.trim() ?? '';
    if (/^[|>][-+]?$/.test(value)) {
      const block: string[] = [];
      while (index + 1 < lines.length && (lines[index + 1].trim() === '' || leadingSpaces(lines[index + 1]) > indent)) {
        index += 1;
        block.push(lines[index].trim());
      }
      value = block.filter(Boolean).join(value.startsWith('>') ? ' ' : '\n');
    }
    add(indent, { key: entry[1], value, children: [] });
  }
  return root;
}

function child(node: YamlNode | undefined, key: string): YamlNode | undefined {
  return node?.children.find((entry) => entry.key === key);
}

function* walk(node: YamlNode): Generator<YamlNode> {
  for (const entry of node.children) {
    yield entry;
    yield* walk(entry);
  }
}

function describeScopes(scopes: Readonly<Record<string, string>>): string {
  return Object.entries(scopes)
    .map(([scope, level]) => `${scope}: ${level}`)
    .join(', ');
}

function scopesMatch(node: YamlNode | undefined, expected: Readonly<Record<string, string>>): boolean {
  if (node === undefined || node.value !== '') return false;
  const actual = Object.fromEntries(node.children.map((entry) => [entry.key, entry.value]));
  const keys = Object.keys(expected);
  return (
    Object.keys(actual).length === keys.length && keys.every((scope) => actual[scope] === expected[scope])
  );
}

type ExpectedGroup = { readonly group: string; readonly cancel: 'true' | 'false' };

function expectedGroups(rule: ConcurrencyRule): { workflow: ExpectedGroup | null; jobs: Map<string, ExpectedGroup> } {
  switch (rule.mode) {
    case 'cancel-superseded':
      return {
        workflow: { group: `${rule.prefix}-\${{ github.event.pull_request.number }}`, cancel: 'true' },
        jobs: new Map(),
      };
    case 'never-cancel':
      return rule.at === 'workflow'
        ? { workflow: { group: rule.group, cancel: 'false' }, jobs: new Map() }
        : { workflow: null, jobs: new Map([[rule.job, { group: rule.group, cancel: 'false' }]]) };
    case 'none':
      return { workflow: null, jobs: new Map() };
  }
}

function concurrencyProblem(where: string, node: YamlNode | undefined, expected: ExpectedGroup | null): string | null {
  if (expected === null) return node === undefined ? null : `${where} must not set concurrency`;
  const group = child(node, 'group')?.value;
  const cancel = child(node, 'cancel-in-progress')?.value;
  if (node?.children.length === 2 && group === expected.group && cancel === expected.cancel) return null;
  return `${where} concurrency must be group ${expected.group} with cancel-in-progress ${expected.cancel}`;
}

function auditFile(file: WorkflowName, source: string): PolicyViolation[] {
  const rule = rules[file];
  const tree = parseYaml(source);
  const jobs = child(tree, 'jobs')?.children ?? [];
  const violations: PolicyViolation[] = [];
  const report = (kind: PolicyViolation['rule'], message: string) => violations.push({ file, rule: kind, message });

  for (const [index, line] of source.split('\n').entries()) {
    const forbidden = forbiddenKeys.exec(line.replace(/(^|\s)#.*$/, ''))?.[1];
    if (forbidden) report('snippet', `line ${index + 1} uses ${forbidden}`);
  }

  for (const node of walk(tree)) {
    if (node.key === 'uses' && !node.value.startsWith('./') && !pinnedUse.test(node.value)) {
      report('pin', `uses ${node.value} is not owner/repo@<40-hex sha> # vX.Y.Z`);
    }
  }

  if (!scopesMatch(child(tree, 'permissions'), readOnly)) {
    report('permission', `workflow permissions must be ${describeScopes(readOnly)}`);
  }
  for (const job of jobs) {
    const expected = job.key === rule.forkJob ? forkJobScopes : readOnly;
    if (!scopesMatch(child(job, 'permissions'), expected)) {
      report('permission', `jobs.${job.key}.permissions must be ${describeScopes(expected)}`);
    }
  }

  if (rule.forkJob !== null) {
    const job = jobs.find((entry) => entry.key === rule.forkJob);
    if (child(job, 'if')?.value !== forkPredicate) {
      report('fork', `jobs.${rule.forkJob}.if must be ${forkPredicate}`);
    }
  }

  const groups = expectedGroups(rule.concurrency);
  const workflowProblem = concurrencyProblem('workflow', child(tree, 'concurrency'), groups.workflow);
  if (workflowProblem) report('concurrency', workflowProblem);
  for (const job of jobs) {
    const problem = concurrencyProblem(`jobs.${job.key}`, child(job, 'concurrency'), groups.jobs.get(job.key) ?? null);
    if (problem) report('concurrency', problem);
  }
  for (const id of groups.jobs.keys()) {
    if (!jobs.some((job) => job.key === id)) report('concurrency', `jobs.${id} is missing`);
  }

  return violations;
}

function isWorkflowName(name: string): name is WorkflowName {
  return Object.hasOwn(rules, name);
}

export function auditWorkflows(files: readonly WorkflowSource[]): readonly PolicyViolation[] {
  const present = new Set(files.map((file) => file.name));
  return [
    ...files.flatMap((file) =>
      isWorkflowName(file.name)
        ? auditFile(file.name, file.source)
        : [{ file: file.name, rule: 'unclassified' as const, message: 'has no rule in workflow-policy.ts' }],
    ),
    ...Object.keys(rules)
      .filter((name) => !present.has(name))
      .map((name) => ({ file: name, rule: 'unclassified' as const, message: 'has a rule but no workflow file' })),
  ];
}

if (import.meta.main) {
  const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '.github', 'workflows');
  const names = (await readdir(dir)).filter((name) => /\.ya?ml$/.test(name)).toSorted();
  const files = await Promise.all(
    names.map(async (name) => ({ name, source: await readFile(path.join(dir, name), 'utf8') })),
  );
  const violations = auditWorkflows(files);
  for (const violation of violations) {
    process.stderr.write(`${violation.file} ${violation.rule} ${violation.message}\n`);
  }
  process.stdout.write(`workflows ${files.length}\nviolations ${violations.length}\n`);
  if (violations.length > 0) process.exit(1);
}
