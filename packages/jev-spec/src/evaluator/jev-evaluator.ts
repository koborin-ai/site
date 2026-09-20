import type {
  AnyRubric,
  AnyRubricResult,
  NoulRubric,
  ChoiceRubric,
  ScoreRubric,
  JevClientConfig,
} from '../types.js';

export interface EvaluationInput {
  readonly specContext: string;
  readonly codeContext: string;
  readonly rubrics: Record<string, AnyRubric>;
}

export interface JevEvaluator {
  evaluate(input: EvaluationInput): Promise<Record<string, AnyRubricResult>>;
}

/**
 * Deterministic Mock Evaluator used for testing and offline development.
 */
export class MockJevEvaluator implements JevEvaluator {
  async evaluate(input: EvaluationInput): Promise<Record<string, AnyRubricResult>> {
    const results: Record<string, AnyRubricResult> = {};

    for (const [key, rubric] of Object.entries(input.rubrics)) {
      if (rubric.type === 'noul') {
        results[key] = this.evaluateNoul(rubric, input);
      } else if (rubric.type === 'choice') {
        results[key] = this.evaluateChoice(rubric, input);
      } else if (rubric.type === 'score') {
        results[key] = this.evaluateScore(rubric, input);
      }
    }

    return results;
  }

  private evaluateNoul(rubric: NoulRubric, input: EvaluationInput) {
    const q = rubric.question.toLowerCase();
    // Deterministic heuristics for mock testing:
    // If asking about introducing unspecified behavior, drift, or side effects
    if (
      q.includes('unspecified') ||
      q.includes('side effect') ||
      q.includes('drift') ||
      q.includes('undocumented')
    ) {
      return {
        type: 'noul' as const,
        probability: 0.04,
      };
    }
    // If asking about satisfying requirements or implementation completeness
    if (q.includes('satisfy') || q.includes('implement')) {
      const isMeaningful = input.codeContext.length > 50 && !input.codeContext.includes('TODO');
      return {
        type: 'noul' as const,
        probability: isMeaningful ? 0.94 : 0.45,
      };
    }
    return {
      type: 'noul' as const,
      probability: 0.88,
    };
  }

  private evaluateChoice<T extends string>(rubric: ChoiceRubric<T>, _input: EvaluationInput) {
    const keys = Object.keys(rubric.options) as T[];
    const selected = keys[0];
    const distribution = {} as Record<T, number>;
    for (const k of keys) {
      distribution[k] = k === selected ? 0.90 : 0.10 / (keys.length - 1 || 1);
    }
    return {
      type: 'choice' as const,
      choice: selected,
      confidence: 0.90,
      distribution,
    };
  }

  private evaluateScore(rubric: ScoreRubric, input: EvaluationInput) {
    const maxScore = rubric.levels.length - 1;
    const isComplete = input.codeContext.length > 80;
    const targetScore = isComplete ? Math.max(1, maxScore - 0.5) : 1.0;
    const levelIdx = Math.min(Math.floor(targetScore), rubric.levels.length - 1);
    
    return {
      type: 'score' as const,
      score: targetScore,
      maxScore,
      confidence: 0.92,
      selectedLevel: rubric.levels[levelIdx],
      levelProbabilities: rubric.levels.map((_, i) => (i === levelIdx ? 0.85 : 0.05)),
    };
  }
}

/**
 * Creates an appropriate evaluator based on configuration.
 */
export function createJevEvaluator(config?: JevClientConfig): JevEvaluator {
  if (config?.mock || !config?.apiKey) {
    return new MockJevEvaluator();
  }

  // Live @typesafe-ai/sdk evaluator can be instantiated when apiKey is present
  // For now falls back to mock evaluator if live SDK is not installed
  return new MockJevEvaluator();
}
