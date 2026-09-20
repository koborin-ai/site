/**
 * Primitive Jev decision types:
 * - noul: calibrated boolean probability in [0, 1]
 * - choice: categorical distribution over a set of options
 * - score: ordinal score on a defined rubric scale
 */

export interface NoulRubric {
  readonly type: 'noul';
  readonly question: string;
}

export interface ChoiceRubric<T extends string = string> {
  readonly type: 'choice';
  readonly description: string;
  readonly options: Record<T, string>;
}

export interface ScoreRubric {
  readonly type: 'score';
  readonly description: string;
  readonly levels: readonly string[];
}

export type AnyRubric = NoulRubric | ChoiceRubric<any> | ScoreRubric;

// Assertions
export interface NoulAssertion {
  readonly minProbability?: number;
  readonly maxProbability?: number;
}

export interface ChoiceAssertion<T extends string = string> {
  readonly allowedChoices?: readonly T[];
  readonly blockedChoices?: readonly T[];
  readonly minConfidence?: number;
}

export interface ScoreAssertion {
  readonly minScore?: number;
  readonly maxScore?: number;
  readonly minConfidence?: number;
}

export type AnyAssertion = NoulAssertion | ChoiceAssertion<any> | ScoreAssertion;

export type AssertionMap<R extends Record<string, AnyRubric>> = {
  [K in keyof R]?: R[K] extends NoulRubric
    ? NoulAssertion
    : R[K] extends ChoiceRubric<infer C>
      ? ChoiceAssertion<C>
      : R[K] extends ScoreRubric
        ? ScoreAssertion
        : never;
};

// Spec Filter
export interface SpecFilter {
  readonly headings?: readonly string[];
  readonly requirementPrefix?: string;
  readonly tags?: readonly string[];
}

// Zone Definition
export interface ZoneConfig<R extends Record<string, AnyRubric> = Record<string, AnyRubric>> {
  readonly description?: string;
  readonly specPath: string;
  readonly codePaths: readonly string[];
  readonly specFilter?: SpecFilter;
  readonly rubrics: R;
  readonly assertions: AssertionMap<R>;
}

// Client Configuration
export interface JevClientConfig {
  readonly apiKey?: string;
  readonly baseUrl?: string;
  readonly timeoutMs?: number;
  readonly mock?: boolean;
}

// Top-level Configuration
export interface JevSpecConfig {
  readonly client?: JevClientConfig;
  readonly zones: Record<string, ZoneConfig<any>>;
}

// Evaluation Results
export interface NoulResult {
  readonly type: 'noul';
  readonly probability: number;
}

export interface ChoiceResult<T extends string = string> {
  readonly type: 'choice';
  readonly choice: T;
  readonly confidence: number;
  readonly distribution: Record<T, number>;
}

export interface ScoreResult {
  readonly type: 'score';
  readonly score: number;
  readonly maxScore: number;
  readonly confidence: number;
  readonly selectedLevel: string;
  readonly levelProbabilities: readonly number[];
}

export type AnyRubricResult = NoulResult | ChoiceResult<any> | ScoreResult;

export interface AssertionEvaluation {
  readonly rubricName: string;
  readonly rubric: AnyRubric;
  readonly result: AnyRubricResult;
  readonly passed: boolean;
  readonly reason?: string;
}

export interface ZoneCheckResult {
  readonly zoneName: string;
  readonly specFiles: readonly string[];
  readonly codeFiles: readonly string[];
  readonly passed: boolean;
  readonly evaluations: readonly AssertionEvaluation[];
  readonly durationMs: number;
  readonly estimatedCostUsd: number;
}

export interface OverallCheckResult {
  readonly passed: boolean;
  readonly zones: readonly ZoneCheckResult[];
  readonly totalDurationMs: number;
  readonly totalEstimatedCostUsd: number;
}
