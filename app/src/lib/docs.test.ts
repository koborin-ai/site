import { describe, expect, it } from 'vitest';
import { categoryOf, counterpartId, localeOf, pathsMatch, publicPath, slugParam } from './docs';

describe('public paths', () => {
  it('maps collection ids onto the existing public URLs', () => {
    expect(publicPath('index')).toBe('/');
    expect(publicPath('ja/index')).toBe('/ja/');
    expect(publicPath('tech/koborin-ai-architecture')).toBe('/tech/koborin-ai-architecture/');
    expect(publicPath('ja/tech/koborin-ai-architecture')).toBe('/ja/tech/koborin-ai-architecture/');
    expect(publicPath('privacy-policy')).toBe('/privacy-policy/');
    expect(publicPath('ja/privacy-policy')).toBe('/ja/privacy-policy/');
  });

  it('uses an empty rest param only for the English home', () => {
    expect(slugParam('index')).toBeUndefined();
    expect(slugParam('ja/index')).toBe('ja');
    expect(slugParam('life/everything-has-meaning')).toBe('life/everything-has-meaning');
    expect(slugParam('ja/life/everything-has-meaning')).toBe('ja/life/everything-has-meaning');
  });
});

describe('locale and category', () => {
  it('reads the locale and category from the id', () => {
    expect(localeOf('ja/life/reflections-on-2025')).toBe('ja');
    expect(localeOf('life/reflections-on-2025')).toBe('en');
    expect(categoryOf('ja/tech/stars-digest')).toBe('tech');
    expect(categoryOf('life/everything-has-meaning')).toBe('life');
    expect(categoryOf('privacy-policy')).toBeUndefined();
    expect(categoryOf('index')).toBeUndefined();
  });

  it('pairs each page with the other language', () => {
    expect(counterpartId('index')).toBe('ja/index');
    expect(counterpartId('ja/index')).toBe('index');
    expect(counterpartId('tech/stars-digest')).toBe('ja/tech/stars-digest');
    expect(counterpartId('ja/privacy-policy')).toBe('privacy-policy');
  });

  it('treats a missing trailing slash as the same path', () => {
    expect(pathsMatch('/ja', '/ja/')).toBe(true);
    expect(pathsMatch('/tech/stars-digest', '/tech/stars-digest/')).toBe(true);
    expect(pathsMatch('/', '/ja/')).toBe(false);
  });
});
