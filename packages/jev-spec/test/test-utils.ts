import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

export { test, describe, before, after, assert };
export const expect = (actual: any) => ({
  toBe: (expected: any) => assert.strictEqual(actual, expected),
  toEqual: (expected: any) => assert.deepStrictEqual(actual, expected),
  toBeDefined: () => assert.notStrictEqual(actual, undefined),
  toHaveLength: (len: number) => assert.strictEqual(actual.length, len),
  toContain: (item: any) => {
    if (typeof actual === 'string') {
      assert.ok(actual.includes(item), `Expected "${actual}" to contain "${item}"`);
    } else if (Array.isArray(actual)) {
      assert.ok(actual.includes(item), `Expected array to contain ${item}`);
    } else {
      assert.ok(false, 'Unsupported type for toContain');
    }
  },
  toBeGreaterThan: (num: number) => assert.ok(actual > num, `Expected ${actual} > ${num}`),
  toBeGreaterThanOrEqual: (num: number) => assert.ok(actual >= num, `Expected ${actual} >= ${num}`),
  toBeInstanceOf: (ctor: new (...args: any[]) => any) =>
    assert.ok(actual instanceof ctor, `Expected value to be instance of ${ctor.name}`),
  toThrow: (pattern?: RegExp | string) => {
    if (pattern instanceof RegExp) {
      assert.throws(actual, pattern);
    } else if (typeof pattern === 'string') {
      assert.throws(actual, new RegExp(pattern));
    } else {
      assert.throws(actual);
    }
  },
});
