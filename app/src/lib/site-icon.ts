const MAX_BYTES = 48 * 1024;

export function siteHostname(href: string, base?: string | URL): string {
  return new URL(href, base).hostname.replace(/^www\./, '');
}

function attr(tag: string, name: string): string | undefined {
  const match = tag.match(new RegExp(String.raw`${name}\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))`, 'i'));
  return match?.[2] ?? match?.[3] ?? match?.[4];
}

function scoreIcon(url: URL, rel: string, sizes: string): number {
  const nums = sizes.split(/[^\d.]+/).map(Number).filter((n) => n > 0);
  const size = nums.length ? Math.min(...nums) : 32;
  let score = size >= 16 && size <= 64 ? 100 - Math.abs(size - 32) : 10;
  if (/apple-touch-icon/i.test(rel)) score -= 40;
  if (url.pathname.endsWith('.svg')) score += 5;
  return score;
}

export function pickIconUrl(html: string, pageUrl: string): string | null {
  let best: { href: string; score: number } | undefined;
  for (const match of html.matchAll(/<link\b[^>]*>/gi)) {
    const tag = match[0];
    const rel = attr(tag, 'rel') ?? '';
    if (!/(?:shortcut\s+)?icon|apple-touch-icon/i.test(rel) || /mask-icon/i.test(rel)) continue;
    const href = attr(tag, 'href');
    if (!href) continue;
    let url: URL;
    try {
      url = new URL(href, pageUrl);
    } catch {
      continue;
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') continue;
    const candidate = { href: url.href, score: scoreIcon(url, rel, attr(tag, 'sizes') ?? '') };
    if (!best || candidate.score > best.score) best = candidate;
  }
  return best?.href ?? null;
}

function mimeFor(bytes: Uint8Array, header: string | null): string | null {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return 'image/png';
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.length >= 6 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return 'image/gif';
  if (bytes.length >= 4 && bytes[0] === 0 && bytes[1] === 0 && bytes[2] === 1 && bytes[3] === 0) return 'image/x-icon';
  const text = new TextDecoder().decode(bytes.slice(0, 200)).trimStart().toLowerCase();
  if (text.startsWith('<svg') || (text.startsWith('<?xml') && text.includes('<svg'))) {
    const body = new TextDecoder().decode(bytes).toLowerCase();
    if (body.includes('<script')) return null;
    return 'image/svg+xml';
  }
  if (header?.startsWith('image/') && !header.includes('svg')) return header.split(';')[0] ?? null;
  return null;
}

async function request(fetchImpl: typeof fetch, url: string): Promise<Response | null> {
  try {
    return await fetchImpl(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(4000),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AstroBot/1.0)' },
    });
  } catch {
    return null;
  }
}

async function imageDataUrl(fetchImpl: typeof fetch, url: string): Promise<string | null> {
  const response = await request(fetchImpl, url);
  if (!response?.ok) return null;
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_BYTES) return null;
  const mime = mimeFor(bytes, response.headers.get('content-type'));
  if (!mime) return null;
  return `data:${mime};base64,${Buffer.from(bytes).toString('base64')}`;
}

export async function fetchSiteIcon(pageUrl: string, fetchImpl: typeof fetch = fetch): Promise<string | null> {
  const page = new URL(pageUrl);
  const htmlResponse = await request(fetchImpl, page.href);
  const finalUrl = htmlResponse?.url || page.href;
  const html = htmlResponse?.ok ? (await htmlResponse.text()).slice(0, 500_000) : '';
  const fromMarkup = html ? pickIconUrl(html, finalUrl) : null;
  const favicon = new URL('/favicon.ico', finalUrl).href;
  const urls = fromMarkup && fromMarkup !== favicon ? [fromMarkup, favicon] : [favicon];
  for (const url of urls) {
    const dataUrl = await imageDataUrl(fetchImpl, url);
    if (dataUrl) return dataUrl;
  }
  return null;
}
