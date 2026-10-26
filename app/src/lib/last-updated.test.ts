import { describe, expect, it } from 'vitest';
import { shouldShowUpdated } from './last-updated';

const published = new Date('2026-01-02T00:00:00.000Z');

describe('shouldShowUpdated', () => {
  it('hides an update on the same day as publication', () => {
    const updated = new Date(published.getTime() + 23 * 60 * 60 * 1000);
    expect(shouldShowUpdated(published, updated)).toBe(false);
  });

  it('shows an update once a full day has passed', () => {
    const updated = new Date(published.getTime() + 24 * 60 * 60 * 1000);
    expect(shouldShowUpdated(published, updated)).toBe(true);
  });

  it('shows the updated date when there is no published date', () => {
    expect(shouldShowUpdated(undefined, published)).toBe(true);
  });

  it('hides the updated date when git has no timestamp', () => {
    expect(shouldShowUpdated(published, undefined)).toBe(false);
  });
});
