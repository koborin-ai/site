import { describe, expect, it } from 'vitest';
import { beatPath, beats, getBeat, getBeats } from './beats';

describe('getBeats', () => {
  it('orders tracks newest first', () => {
    const dates = getBeats().map((beat) => beat.date);

    expect(dates).toStrictEqual(dates.toSorted().toReversed());
  });

  it('leaves the source catalog untouched', () => {
    const original = beats.map((beat) => beat.slug);
    getBeats();

    expect(beats.map((beat) => beat.slug)).toStrictEqual(original);
  });
});

describe('getBeat', () => {
  it('finds a track by slug', () => {
    expect(getBeat('slip-road')?.title).toBe('Slip Road');
  });

  it('returns undefined for an unknown slug', () => {
    expect(getBeat('no-such-track')).toBeUndefined();
  });
});

describe('beatPath', () => {
  it('builds a trailing-slash share URL', () => {
    expect(beatPath('slip-road')).toBe('/beats/slip-road/');
  });
});

describe('beat catalog', () => {
  it('uses unique slugs that match the audio file name', () => {
    const slugs = beats.map((beat) => beat.slug);

    expect(new Set(slugs).size).toBe(slugs.length);
    for (const beat of beats) {
      expect(beat.audioSrc).toBe(`/audio/beats/${beat.slug}.mp3`);
    }
  });
});
