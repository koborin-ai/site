import { loadSpec } from '../parser/markdown-parser.js';
import { extractCodeContext } from '../context/code-extractor.js';
import { createJevEvaluator, type JevEvaluator } from '../evaluator/jev-evaluator.js';
import { assertRubric } from './assertion-runner.js';
import type {
  AnyRubric,
  JevSpecConfig,
  OverallCheckResult,
  ZoneCheckResult,
  AssertionEvaluation,
} from '../types.js';
import type { GitDiffOptions } from '../context/types.js';

export interface RunOptions {
  readonly cwd?: string;
  readonly zone?: string;
  readonly evaluator?: JevEvaluator;
  readonly gitDiff?: GitDiffOptions;
}

export async function runVerification(
  config: JevSpecConfig,
  options: RunOptions = {}
): Promise<OverallCheckResult> {
  const cwd = options.cwd ?? process.cwd();
  const evaluator = options.evaluator ?? createJevEvaluator(config.client);
  const startTime = Date.now();

  const zoneNames = options.zone ? [options.zone] : Object.keys(config.zones);

  const zoneResults: ZoneCheckResult[] = [];

  for (const zoneName of zoneNames) {
    const zoneConfig = config.zones[zoneName];
    if (!zoneConfig) {
      throw new Error(`Zone "${zoneName}" not found in configuration`);
    }

    const zoneStart = Date.now();

    const parsedSpec = await loadSpec(zoneConfig.specPath, cwd, zoneConfig.specFilter);

    const codeContext = await extractCodeContext(zoneConfig.codePaths, {
      cwd,
      gitDiff: options.gitDiff,
    });

    const rubricResults = await evaluator.evaluate({
      specContext: parsedSpec.filteredText,
      codeContext: codeContext.combinedPromptContext,
      rubrics: zoneConfig.rubrics,
    });

    const evaluations: AssertionEvaluation[] = [];
    let zonePassed = true;

    for (const [name, rubric] of Object.entries(zoneConfig.rubrics)) {
      const typedRubric = rubric as AnyRubric;
      const result = rubricResults[name];
      if (!result) {
        zonePassed = false;
        evaluations.push({
          rubricName: name,
          rubric: typedRubric,
          result: { type: 'noul', probability: 0 },
          passed: false,
          reason: 'Evaluator did not return a result for this rubric',
        });
        continue;
      }

      const assertion = zoneConfig.assertions[name];
      const ev = assertRubric(name, typedRubric, result, assertion);
      if (!ev.passed) {
        zonePassed = false;
      }
      evaluations.push(ev);
    }

    const zoneDuration = Date.now() - zoneStart;
    const totalChars = parsedSpec.filteredText.length + codeContext.combinedPromptContext.length;
    const estTokens = Math.ceil(totalChars / 4);
    const estCost = (estTokens / 1_000_000) * 0.042;

    zoneResults.push({
      zoneName,
      specFiles: [zoneConfig.specPath],
      codeFiles: codeContext.files.map((f) => f.relativePath),
      passed: zonePassed,
      evaluations,
      durationMs: zoneDuration,
      estimatedCostUsd: estCost,
    });
  }

  const totalDuration = Date.now() - startTime;
  const overallPassed = zoneResults.every((z) => z.passed);
  const totalCost = zoneResults.reduce((acc, z) => acc + z.estimatedCostUsd, 0);

  return {
    passed: overallPassed,
    zones: zoneResults,
    totalDurationMs: totalDuration,
    totalEstimatedCostUsd: totalCost,
  };
}
