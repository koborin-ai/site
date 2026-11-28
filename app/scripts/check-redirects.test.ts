import { describe, expect, it } from 'vitest';
import { checkArticleMetadata, findLegacyRefsInText } from './check-redirects.ts';

describe('findLegacyRefsInText', () => {
  it('flags internal and absolute koborin.ai legacy paths across HTML, XML, and text', () => {
    expect(findLegacyRefsInText('blog/a/index.html', '<a href="/tech/foo/">link</a>')).toHaveLength(1);
    expect(findLegacyRefsInText('blog/a/index.html', '<link rel="canonical" href="https://koborin.ai/ja/life/bar/">')).toHaveLength(1);
    expect(findLegacyRefsInText('blog/a/index.html', '<meta property="og:image" content="https://koborin.ai/og/tech/foo.webp">')).toHaveLength(1);
    expect(findLegacyRefsInText('rss.xml', '<link>https://koborin.ai/life/bar/</link>')).toHaveLength(1);
    expect(findLegacyRefsInText('llms-tech.txt', 'URL: https://koborin.ai/tech/foo/')).toHaveLength(1);
    expect(findLegacyRefsInText('llms-ja-life.txt', '[ref](/ja/life/bar/)')).toHaveLength(1);
  });

  it('allows unified /blog/ URLs and external sites with /tech/ paths', () => {
    expect(findLegacyRefsInText('blog/a/index.html', '<a href="/blog/foo/">ok</a>')).toEqual([]);
    expect(findLegacyRefsInText('blog/a/index.html', '<a href="https://example.com/tech/foo/">ext</a>')).toEqual([]);
    expect(findLegacyRefsInText('llms-full.txt', 'URL: https://koborin.ai/blog/foo/')).toEqual([]);
  });
});

describe('checkArticleMetadata', () => {
  it('accepts a page whose canonical, og:url, og:image, and hreflang match /blog/', () => {
    const html = [
      '<link rel="canonical" href="https://koborin.ai/blog/mcp-deep-dive/">',
      '<meta property="og:url" content="https://koborin.ai/blog/mcp-deep-dive/">',
      '<meta property="og:image" content="https://koborin.ai/og/blog/mcp-deep-dive.webp">',
      '<link rel="alternate" hreflang="en" href="https://koborin.ai/blog/mcp-deep-dive/">',
      '<link rel="alternate" hreflang="ja" href="https://koborin.ai/ja/blog/mcp-deep-dive/">',
    ].join('\n');
    expect(checkArticleMetadata('/blog/mcp-deep-dive/', html)).toEqual([]);
  });

  it('reports missing or legacy metadata tags', () => {
    const problems = checkArticleMetadata('/ja/blog/mcp-deep-dive/', '<link rel="canonical" href="https://koborin.ai/ja/tech/mcp-deep-dive/">');
    expect(problems.length).toBeGreaterThanOrEqual(4);
  });
});
