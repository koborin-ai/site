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

/** Public URL for a docs collection id, including the trailing slash Starlight used. */
export function publicPath(id: string): string {
  const bare = barePath(id);
  if (localeOf(id) === 'ja') return bare === '' ? '/ja/' : `/ja/${bare}/`;
  return bare === '' ? '/' : `/${bare}/`;
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
