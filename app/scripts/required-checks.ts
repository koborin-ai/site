import { text } from 'node:stream/consumers';

type AreaPaths = {
  readonly dirs?: readonly `${string}/`[];
  readonly files?: readonly string[];
  readonly extensions?: readonly `.${string}`[];
};

export const areaPaths = {
  app: {
    dirs: ['app/', 'content/'],
    files: [
      '.tool-versions',
      'mise.toml',
      '.github/workflows/app-ci.yml',
      '.github/workflows/app-release.yml',
      '.github/workflows/required-checks.yml',
    ],
  },
  infra: {
    dirs: ['infra/'],
    files: [
      '.tool-versions',
      'mise.toml',
      '.github/workflows/plan-infra.yml',
      '.github/workflows/required-checks.yml',
    ],
  },
  automation: {
    dirs: ['.github/workflows/', '.github/scripts/', 'app/scripts/'],
    files: ['.tool-versions', 'mise.toml', '.github/actionlint.yaml', '.markdownlint.yaml'],
    extensions: ['.md'],
  },
} as const satisfies Record<string, AreaPaths>;

export type Area = keyof typeof areaPaths;

export const areas = Object.keys(areaPaths) as readonly Area[];

export type JobResult = 'success' | 'skipped' | 'failure' | 'cancelled' | 'absent';

const passes: Record<JobResult, { readonly required: boolean; readonly optional: boolean }> = {
  success: { required: true, optional: true },
  skipped: { required: false, optional: true },
  absent: { required: false, optional: true },
  failure: { required: false, optional: false },
  cancelled: { required: false, optional: false },
};

const reportedResults = ['success', 'skipped', 'failure', 'cancelled'] as const;

export type GateRow = {
  readonly job: 'changes' | Area;
  readonly required: boolean;
  readonly result: JobResult;
  readonly pass: boolean;
};

export type GateReport = { readonly pass: boolean; readonly rows: readonly GateRow[] };

function inArea(file: string, rules: AreaPaths): boolean {
  return (
    (rules.dirs?.some((dir) => file.startsWith(dir)) ?? false) ||
    (rules.files?.includes(file) ?? false) ||
    (rules.extensions?.some((extension) => file.endsWith(extension)) ?? false)
  );
}

export function changedAreas(files: readonly string[]): Area[] {
  return areas.filter((area) => files.some((file) => inArea(file, areaPaths[area])));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isArea(value: unknown): value is Area {
  return typeof value === 'string' && Object.hasOwn(areaPaths, value);
}

function resultOf(jobs: Record<string, unknown>, job: string): JobResult {
  if (!Object.hasOwn(jobs, job)) return 'absent';
  const entry = jobs[job];
  const result = isRecord(entry) ? entry.result : undefined;
  return reportedResults.find((known) => known === result) ?? 'failure';
}

function parseAreas(raw: unknown): readonly Area[] | null {
  if (typeof raw !== 'string') return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.every(isArea) ? parsed : null;
  } catch {
    return null;
  }
}

function row(job: GateRow['job'], required: boolean, result: JobResult): GateRow {
  return { job, required, result, pass: passes[result][required ? 'required' : 'optional'] };
}

export function judgeGate(needs: unknown): GateReport {
  const jobs = isRecord(needs) ? needs : {};
  const detection = resultOf(jobs, 'changes');
  const changesEntry = jobs.changes;
  const changed =
    detection === 'success' && isRecord(changesEntry) && isRecord(changesEntry.outputs)
      ? parseAreas(changesEntry.outputs.areas)
      : null;
  const rows = [
    row('changes', true, detection === 'success' && changed === null ? 'failure' : detection),
    ...areas.map((area) => row(area, changed === null || changed.includes(area), resultOf(jobs, area))),
  ];
  return { pass: rows.every((entry) => entry.pass), rows };
}

function formatReport(report: GateReport): string {
  return [
    '| job | required | result | verdict |',
    '| --- | --- | --- | --- |',
    ...report.rows.map(
      (entry) =>
        `| ${entry.job} | ${entry.required ? 'yes' : 'no'} | ${entry.result} | ${entry.pass ? 'pass' : 'fail'} |`,
    ),
    '',
    `required-checks ${report.pass ? 'passed' : 'failed'}`,
    '',
  ].join('\n');
}

function parseJson(raw: string | undefined): unknown {
  if (raw === undefined) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

if (import.meta.main) {
  const command = process.argv[2];
  if (command === 'areas') {
    const files = (await text(process.stdin)).split('\0').filter(Boolean);
    const touched = changedAreas(files);
    process.stderr.write(`changed files ${files.length}\nareas ${touched.join(', ') || 'none'}\n`);
    process.stdout.write(`areas=${JSON.stringify(touched)}\n`);
  } else if (command === 'verdict') {
    const report = judgeGate(parseJson(process.env.NEEDS));
    process.stdout.write(formatReport(report));
    if (!report.pass) process.exit(1);
  } else {
    process.stderr.write('usage: node scripts/required-checks.ts areas|verdict\n');
    process.exit(2);
  }
}
