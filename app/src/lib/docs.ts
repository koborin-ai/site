export type Locale = 'en' | 'ja';
export type Category = 'tech' | 'life';

export function localeOf(id: string): Locale {
  return id === 'ja' || id.startsWith('ja/') ? 'ja' : 'en';
}

function barePath(id: string): string {
  const withoutLocale = localeOf(id) === 'ja' ? id.slice(3) : id;
  if (withoutLocale === '' || withoutLocale === 'index') return '';
  if (withoutLocale.endsWith('/index')) return withoutLocale.slice(0, -'/index'.length);
  return withoutLocale;
}

function publicBarePath(id: string): string {
  const bare = barePath(id);
  const category = categoryOf(id);
  if (!category) return bare;
  if (bare === category) return 'blog';
  return `blog/${bare.slice(category.length + 1)}`;
}

/** Public URL for a docs collection id, unifying tech/ and life/ articles under /blog/. */
export function publicPath(id: string): string {
  const bare = publicBarePath(id);
  if (localeOf(id) === 'ja') return bare === '' ? '/ja/' : `/ja/${bare}/`;
  return bare === '' ? '/' : `/${bare}/`;
}

/** Fails when two docs ids resolve to the same public URL, e.g. a slug shared across tech/ and life/. */
export function assertUniquePublicPaths(ids: readonly string[]): void {
  const owners = new Map<string, string>();
  for (const id of ids) {
    const url = publicPath(id);
    const existing = owners.get(url);
    if (existing !== undefined) {
      throw new Error(`Duplicate public URL ${url} for "${existing}" and "${id}"`);
    }
    owners.set(url, id);
  }
}

/** Rest param for `[...slug].astro`. The English home is the route with no slug. */
export function slugParam(id: string): string | undefined {
  const path = publicPath(id);
  if (path === '/') return undefined;
  return path.slice(1, -1);
}

export function categoryOf(id: string): Category | undefined {
  const bare = barePath(id);
  if (bare === 'tech' || bare.startsWith('tech/')) return 'tech';
  if (bare === 'life' || bare.startsWith('life/')) return 'life';
  return undefined;
}

export function counterpartId(id: string): string {
  if (localeOf(id) === 'ja') {
    const rest = id.slice(3);
    return rest === '' ? 'index' : rest;
  }
  return id === 'index' ? 'ja' : `ja/${id}`;
}

function withTrailingSlash(path: string): string {
  if (path === '/') return '/';
  return path.endsWith('/') ? path : `${path}/`;
}

export function pathsMatch(left: string, right: string): boolean {
  return withTrailingSlash(left) === withTrailingSlash(right);
}
