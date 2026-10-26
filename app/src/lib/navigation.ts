import { sidebar } from '../sidebar';
import {
  pathsMatch,
  publicPath,
  type Category,
  type Locale,
} from './docs';

export interface NavLink {
  type: 'link';
  label: string;
  href: string;
  current: boolean;
}

export interface NavItem {
  label: string;
  href: string;
  current: boolean;
  draft: boolean;
}

export interface NavGroup {
  type: 'group';
  label: string;
  items: NavItem[];
}

export type NavNode = NavLink | NavGroup;

export interface Neighbor {
  label: string;
  href: string;
}

export interface DraftIndex {
  has: (id: string) => boolean;
}

export interface SidebarLink {
  label: string;
  link: string;
  translations?: { ja?: string };
}

export interface SidebarItem {
  label: string;
  slug: string;
  translations?: { ja?: string };
}

export interface SidebarGroup {
  label: string;
  items: readonly SidebarItem[];
}

export type SidebarEntry = SidebarLink | SidebarGroup;

function isGroup(entry: SidebarEntry): entry is SidebarGroup {
  return 'items' in entry;
}

function labelFor(entry: { label: string; translations?: { ja?: string } }, locale: Locale): string {
  if (locale === 'ja' && entry.translations?.ja) return entry.translations.ja;
  return entry.label;
}

function localizedLink(link: string, locale: Locale): string {
  const withSlash = link === '/' ? '/' : link.endsWith('/') ? link : `${link}/`;
  if (locale === 'en') return withSlash;
  return withSlash === '/' ? '/ja/' : `/ja${withSlash}`;
}

function entryId(slug: string, locale: Locale): string {
  return locale === 'ja' ? `ja/${slug}` : slug;
}

export function navFromEntries(
  entries: readonly SidebarEntry[],
  locale: Locale,
  currentPath: string,
  drafts: DraftIndex,
  includeDrafts: boolean,
): NavNode[] {
  const nodes: NavNode[] = [];
  for (const entry of entries) {
    if (!isGroup(entry)) {
      const href = localizedLink(entry.link, locale);
      nodes.push({
        type: 'link',
        label: labelFor(entry, locale),
        href,
        current: pathsMatch(href, currentPath),
      });
      continue;
    }

    const items: NavItem[] = [];
    for (const item of entry.items) {
      const id = entryId(item.slug, locale);
      const draft = drafts.has(id);
      if (draft && !includeDrafts) continue;
      const href = publicPath(id);
      items.push({
        label: labelFor(item, locale),
        href,
        current: pathsMatch(href, currentPath),
        draft,
      });
    }
    if (items.length === 0) continue;
    nodes.push({ type: 'group', label: entry.label, items });
  }
  return nodes;
}

export function buildNav(
  locale: Locale,
  currentPath: string,
  drafts: DraftIndex,
  includeDrafts: boolean,
): NavNode[] {
  return navFromEntries(sidebar, locale, currentPath, drafts, includeDrafts);
}

export function categoryNeighbors(
  nav: readonly NavNode[],
  currentPath: string,
  category: Category | undefined,
): { prev?: Neighbor; next?: Neighbor } {
  if (!category) return {};
  const group = nav.find(
    (node): node is NavGroup =>
      node.type === 'group' && node.items.some((item) => item.href.includes(`/${category}/`)),
  );
  if (!group) return {};
  const index = group.items.findIndex((item) => pathsMatch(item.href, currentPath));
  if (index < 0) return {};
  const prev = group.items[index - 1];
  const next = group.items[index + 1];
  return {
    ...(prev ? { prev: { label: prev.label, href: prev.href } } : {}),
    ...(next ? { next: { label: next.label, href: next.href } } : {}),
  };
}

export function alternateHref(
  id: string,
  available: ReadonlySet<string>,
): { locale: Locale; href: string }[] {
  const englishId = id.startsWith('ja/') || id === 'ja' ? id.slice(3) || 'index' : id;
  const japaneseId = englishId === 'index' ? 'ja/index' : `ja/${englishId}`;
  const hrefFor = (docId: string, locale: Locale) =>
    available.has(docId) ? publicPath(docId) : locale === 'ja' ? '/ja/' : '/';
  return [
    { locale: 'en', href: hrefFor(englishId, 'en') },
    { locale: 'ja', href: hrefFor(japaneseId, 'ja') },
  ];
}
