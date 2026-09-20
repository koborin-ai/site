import type {
  AnyRubric,
  AnyRubricResult,
  AnyAssertion,
  AssertionEvaluation,
  NoulResult,
  ChoiceResult,
  ScoreResult,
  NoulAssertion,
  ChoiceAssertion,
  ScoreAssertion,
} from '../types.js';

export function assertRubric(
  rubricName: string,
  rubric: AnyRubric,
  result: AnyRubricResult,
  assertion?: AnyAssertion
): AssertionEvaluation {
  if (!assertion) {
    return {
      rubricName,
      rubric,
      result,
      passed: true,
    };
  }

  if (result.type === 'noul') {
    return assertNoul(rubricName, rubric, result, assertion as NoulAssertion);
  } else if (result.type === 'choice') {
    return assertChoice(rubricName, rubric, result, assertion as ChoiceAssertion);
  } else if (result.type === 'score') {
    return assertScore(rubricName, rubric, result, assertion as ScoreAssertion);
  }

  return {
    rubricName,
    rubric,
    result,
    passed: true,
  };
}

function assertNoul(
  rubricName: string,
  rubric: AnyRubric,
  result: NoulResult,
  assertion: NoulAssertion
): AssertionEvaluation {
  if (assertion.minProbability !== undefined && result.probability < assertion.minProbability) {
    return {
      rubricName,
      rubric,
      result,
      passed: false,
      reason: `Probability ${result.probability.toFixed(2)} is below minimum threshold ${assertion.minProbability.toFixed(2)}`,
    };
  }

  if (assertion.maxProbability !== undefined && result.probability > assertion.maxProbability) {
    return {
      rubricName,
      rubric,
      result,
      passed: false,
      reason: `Probability ${result.probability.toFixed(2)} exceeds maximum threshold ${assertion.maxProbability.toFixed(2)}`,
    };
  }

  return { rubricName, rubric, result, passed: true };
}

function assertChoice(
  rubricName: string,
  rubric: AnyRubric,
  result: ChoiceResult,
  assertion: ChoiceAssertion
): AssertionEvaluation {
  if (assertion.allowedChoices && !assertion.allowedChoices.includes(result.choice)) {
    return {
      rubricName,
      rubric,
      result,
      passed: false,
      reason: `Selected choice "${result.choice}" is not in allowed list: [${assertion.allowedChoices.join(', ')}]`,
    };
  }

  if (assertion.blockedChoices && assertion.blockedChoices.includes(result.choice)) {
    return {
      rubricName,
      rubric,
      result,
      passed: false,
      reason: `Selected choice "${result.choice}" is in blocked list: [${assertion.blockedChoices.join(', ')}]`,
    };
  }

  if (assertion.minConfidence !== undefined && result.confidence < assertion.minConfidence) {
    return {
      rubricName,
      rubric,
      result,
      passed: false,
      reason: `Confidence ${result.confidence.toFixed(2)} is below required threshold ${assertion.minConfidence.toFixed(2)}`,
    };
  }

  return { rubricName, rubric, result, passed: true };
}

function assertScore(
  rubricName: string,
  rubric: AnyRubric,
  result: ScoreResult,
  assertion: ScoreAssertion
): AssertionEvaluation {
  if (assertion.minScore !== undefined && result.score < assertion.minScore) {
    return {
      rubricName,
      rubric,
      result,
      passed: false,
      reason: `Score ${result.score.toFixed(1)} is below minimum threshold ${assertion.minScore.toFixed(1)}`,
    };
  }

  if (assertion.maxScore !== undefined && result.score > assertion.maxScore) {
    return {
      rubricName,
      rubric,
      result,
      passed: false,
      reason: `Score ${result.score.toFixed(1)} exceeds maximum threshold ${assertion.maxScore.toFixed(1)}`,
    };
  }

  return { rubricName, rubric, result, passed: true };
}
