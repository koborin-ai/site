import { describe, test as it, before, after } from 'node:test';
import { expect } from './test-utils.js';
import {
  MockJevEvaluator,
  LiveJevEvaluator,
  JevSpecConfigurationError,
  createJevEvaluator,
  resolveApiKey,
} from '../src/evaluator/jev-evaluator.js';
import { noul, choice, score } from '../src/dsl.js';

describe('Jev evaluator', () => {
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

  it('resolves API key from TYPESAFE_AI_API_KEY and TYPESAFE_API_KEY', () => {
    delete process.env.TYPESAFE_AI_API_KEY;
    process.env.TYPESAFE_API_KEY = 'from-typesafe-key';
    expect(resolveApiKey()).toBe('from-typesafe-key');

    process.env.TYPESAFE_AI_API_KEY = 'from-ai-key';
    expect(resolveApiKey()).toBe('from-ai-key');
  });

  it('uses mock evaluator only when mock flag is explicitly set', () => {
    delete process.env.TYPESAFE_AI_API_KEY;
    delete process.env.TYPESAFE_API_KEY;
    expect(createJevEvaluator({ mock: true })).toBeInstanceOf(MockJevEvaluator);
  });

  it('throws when API key is missing and mock mode is not enabled', () => {
    delete process.env.TYPESAFE_AI_API_KEY;
    delete process.env.TYPESAFE_API_KEY;
    try {
      createJevEvaluator({});
      throw new Error('expected createJevEvaluator to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(JevSpecConfigurationError);
      expect((error as Error).message).toContain('API key is required');
    }
  });

  it('uses live evaluator when API key is present', () => {
    expect(createJevEvaluator({ apiKey: 'test-key' })).toBeInstanceOf(LiveJevEvaluator);
  });

  it('evaluates noul, choice, and score rubrics in parallel via mock', async () => {
    const evaluator = new MockJevEvaluator();
    const results = await evaluator.evaluate({
      specContext: 'REQ-01: verify tokens',
      codeContext: 'export function verifyToken(token: string) { return token.startsWith("valid"); }',
      rubrics: {
        satisfies: noul('Does the implementation satisfy the specification?'),
        posture: choice('Security posture', {
          secure: 'Secure handling',
          insecure: 'Insecure handling',
        }),
        completeness: score('Completeness', ['Stub', 'Partial', 'Complete']),
      },
    });

    expect(results.satisfies.type).toBe('noul');
    expect(results.posture.type).toBe('choice');
    expect(results.completeness.type).toBe('score');
  });
});
