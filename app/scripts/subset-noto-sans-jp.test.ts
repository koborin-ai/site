import { describe, expect, it } from 'vitest';
import {
  collectCharacters,
  decodeEntities,
  fontFaceCss,
  unicodeRange,
  verticalOverrides,
} from './subset-noto-sans-jp.ts';

describe('Japanese font subset', () => {
  it('keeps the base kana set and a character that only the page uses', () => {
    const codes = new Set(collectCharacters(['<p>漢字</p>']));

    expect(codes.has('A'.codePointAt(0) ?? 0)).toBe(true);
    expect(codes.has('あ'.codePointAt(0) ?? 0)).toBe(true);
    expect(codes.has('ア'.codePointAt(0) ?? 0)).toBe(true);
    expect(codes.has('、'.codePointAt(0) ?? 0)).toBe(true);
    expect(codes.has('漢'.codePointAt(0) ?? 0)).toBe(true);
    expect(codes.has('龍'.codePointAt(0) ?? 0)).toBe(false);
  });

  it('reads a numeric character reference as the character it names', () => {
    expect(decodeEntities('&#x6F22;')).toBe('漢');
    expect(collectCharacters(['&#x9F8D;']).includes('龍'.codePointAt(0) ?? 0)).toBe(true);
  });

  it('writes one swap face per weight and collapses neighbouring code points', () => {
    const css = fontFaceCss(
      [
        { weight: 400, href: '/fonts/noto-sans-jp-400-abcdef12.woff2' },
        { weight: 500, href: '/fonts/noto-sans-jp-500-abcdef12.woff2' },
      ],
      unicodeRange([0x41, 0x42, 0x44]),
    );

    expect(css).toContain('font-display: swap');
    expect(css).toContain('font-weight: 400');
    expect(css).toContain('font-weight: 500');
    expect(css).toContain('font-family: "Noto Sans JP"');
    expect(css).toContain('unicode-range: U+41-42, U+44');
    expect(css.match(/@font-face/g)).toHaveLength(2);
  });

  it('turns the source face metrics into the fallback overrides', () => {
    expect(verticalOverrides({ unitsPerEm: 1000, ascent: 1160, descent: -288, lineGap: 0 })).toEqual({
      ascent: '116%',
      descent: '28.8%',
      lineGap: '0%',
    });
  });
});
