import { describe, expect, it } from 'vitest';
import { alternateHref, buildNav, categoryNeighbors, navFromEntries, type SidebarEntry } from './navigation';

const drafts = {
  has: (id: string) => id.endsWith('acknowledging-aging'),
};

const fixture: SidebarEntry[] = [
  { label: 'Home', link: '/' },
  {
    label: 'Life',
    items: [
      { label: 'Acknowledging Aging', slug: 'life/acknowledging-aging' },
      { label: 'Everything Has Meaning', slug: 'life/everything-has-meaning' },
    ],
  },
];

describe('sidebar nav', () => {
  it('uses the Japanese label and marks the current article', () => {
    const nav = buildNav('ja', '/ja/tech/jev-spec-introduction/', drafts, false);
    const tech = nav.find((node) => node.type === 'group' && node.label === 'Tech');
    if (!tech || tech.type !== 'group') throw new Error('Tech group missing');
    const jev = tech.items.find((item) => item.href === '/ja/tech/jev-spec-introduction/');
    expect(jev?.label).toBe('jev-spec を作っている話');
    expect(jev?.current).toBe(true);
    const home = nav.find((node) => node.type === 'link');
    if (!home || home.type !== 'link') throw new Error('Home link missing');
    expect(home.href).toBe('/ja/');
  });

  it('drops draft links in production and badges them in dev', () => {
    const production = navFromEntries(fixture, 'en', '/', drafts, false);
    const life = production.find((node) => node.type === 'group');
    if (!life || life.type !== 'group') throw new Error('Life group missing');
    expect(life.items.map((item) => item.href)).toEqual(['/life/everything-has-meaning/']);

    const dev = navFromEntries(fixture, 'ja', '/ja/', drafts, true);
    const devLife = dev.find((node) => node.type === 'group');
    if (!devLife || devLife.type !== 'group') throw new Error('Life group missing');
    expect(devLife.items[0]).toMatchObject({
      href: '/ja/life/acknowledging-aging/',
      draft: true,
    });
  });
});

describe('article neighbors', () => {
  const nav = buildNav('en', '/tech/stars-digest/', drafts, false);

  it('stays inside the same category and sidebar order', () => {
    expect(categoryNeighbors(nav, '/tech/stars-digest/', 'tech')).toEqual({
      prev: {
        label: 'Cursor Automations for Solo Maintainers',
        href: '/tech/solo-maintainer-cursor-automations/',
      },
      next: {
        label: 'contextlint v0.9 — LSP & VS Code Extension',
        href: '/tech/contextlint-lsp-and-editor-integration/',
      },
    });
  });

  it('has no next page after the last tech article', () => {
    expect(categoryNeighbors(nav, '/tech/firebase-auth-token-deep-dive/', 'tech').next).toBeUndefined();
  });

  it('gives the home page no neighbors', () => {
    expect(categoryNeighbors(nav, '/', undefined)).toEqual({});
  });
});

describe('language switch', () => {
  it('links the translated page when it exists', () => {
    const available = new Set(['tech/stars-digest', 'ja/tech/stars-digest', 'index', 'ja/index']);
    expect(alternateHref('tech/stars-digest', available)).toEqual([
      { locale: 'en', href: '/tech/stars-digest/' },
      { locale: 'ja', href: '/ja/tech/stars-digest/' },
    ]);
  });

  it('falls back to the other home when the pair is missing', () => {
    const available = new Set(['tech/stars-digest', 'index', 'ja/index']);
    expect(alternateHref('tech/stars-digest', available)).toEqual([
      { locale: 'en', href: '/tech/stars-digest/' },
      { locale: 'ja', href: '/ja/' },
    ]);
  });
});
