import { describe, test as it } from 'node:test';
import { expect } from './test-utils.js';
import { noul, choice, score, defineConfig } from '../src/dsl.js';

describe('jev-spec DSL', () => {
  it('creates noul rubric', () => {
    const r = noul('Does it satisfy requirement REQ-01?');
    expect(r.type).toBe('noul');
    expect(r.question).toBe('Does it satisfy requirement REQ-01?');
  });

  it('creates choice rubric', () => {
    const r = choice('Security compliance', {
      compliant: 'Complies with all rules',
      vulnerable: 'Contains security flaws',
    });
    expect(r.type).toBe('choice');
    expect(r.options.compliant).toBe('Complies with all rules');
  });

  it('creates score rubric', () => {
    const r = score('Completeness', ['Stub', 'Partial', 'Complete']);
    expect(r.type).toBe('score');
    expect(r.levels).toHaveLength(3);
  });

  it('throws on score with fewer than 2 levels', () => {
    expect(() => score('Invalid', ['Only one'])).toThrow(/between 2 and 10/);
  });

  it('validates defineConfig type inference', () => {
    const cfg = defineConfig({
      zones: {
        testZone: {
          specPath: 'spec.md',
          codePaths: ['src/**/*.ts'],
          rubrics: {
            check: noul('Is it working?'),
          },
          assertions: {
            check: { minProbability: 0.9 },
          },
        },
      },
    });
    expect(cfg.zones.testZone).toBeDefined();
  });
});
