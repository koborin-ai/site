export type Choice = 'granted' | 'denied';
export type Banner = 'hidden' | 'asking' | 'reviewing';

type Decision = Choice | 'unset';
type State = { readonly decision: Decision; readonly reviewing: boolean };
type ConsentEvent = { readonly type: 'chose'; readonly choice: Choice } | { readonly type: 'reopened' };

const STORAGE_KEY = 'cookie_consent';
const WIRE: Record<Choice, string> = { granted: 'accepted', denied: 'rejected' };
const GTAG_URL = 'https://www.googletagmanager.com/gtag/js?id=';

type MeasurementId = string & { readonly __brand: 'MeasurementId' };

function parseMeasurementId(raw: string | null | undefined): MeasurementId | null {
  return raw && /^G-[A-Z0-9]+$/.test(raw) ? (raw as MeasurementId) : null;
}

function parseDecision(raw: string | null): Decision {
  if (raw === WIRE.granted) return 'granted';
  if (raw === WIRE.denied) return 'denied';
  return 'unset';
}

function readDecision(): Decision {
  try {
    return parseDecision(localStorage.getItem(STORAGE_KEY));
  } catch {
    return 'unset';
  }
}

function writeChoice(choice: Choice): void {
  try {
    localStorage.setItem(STORAGE_KEY, WIRE[choice]);
  } catch {
    return;
  }
}

function next(state: State, event: ConsentEvent): State {
  switch (event.type) {
    case 'chose':
      return { decision: event.choice, reviewing: false };
    case 'reopened':
      return { ...state, reviewing: true };
  }
}

function bannerOf(state: State): Banner {
  if (state.reviewing) return 'reviewing';
  return state.decision === 'unset' ? 'asking' : 'hidden';
}

type GtagWindow = Window & { dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void } & Record<string, unknown>;
const ga = window as unknown as GtagWindow;

function gtag(..._args: unknown[]): void {
  // gtag.js only treats Arguments objects as commands.
  (ga.dataLayer ??= []).push(arguments);
}

function disableKey(id: MeasurementId): string {
  return `ga-disable-${id}`;
}

function syncAnalytics(id: MeasurementId, allowed: boolean): void {
  const loaded = document.querySelector(`script[src="${GTAG_URL}${id}"]`) !== null;
  const halted = ga[disableKey(id)] === true;
  if (allowed && !loaded) {
    ga[disableKey(id)] = false;
    ga.gtag = gtag;
    gtag('js', new Date());
    gtag('config', id);
    const script = document.createElement('script');
    script.async = true;
    script.src = GTAG_URL + id;
    document.head.appendChild(script);
  } else if (allowed && halted) {
    ga[disableKey(id)] = false;
    gtag('consent', 'update', { analytics_storage: 'granted' });
    gtag('config', id);
  } else if (!allowed && loaded && !halted) {
    ga[disableKey(id)] = true;
    gtag('consent', 'update', { analytics_storage: 'denied' });
  }
}

function isAnalyticsCookie(name: string): boolean {
  return name === '_ga' || name.startsWith('_ga_');
}

function cookieDomains(hostname: string): string[] {
  const labels = hostname.split('.');
  const domains: string[] = [];
  for (let start = 0; start < labels.length - 1; start += 1) {
    domains.push(labels.slice(start).join('.'));
  }
  return domains;
}

function purgeAnalyticsCookies(): void {
  const names = document.cookie.split(';').map((pair) => pair.trim().split('=')[0] ?? '');
  for (const name of names.filter(isAnalyticsCookie)) {
    document.cookie = `${name}=; Max-Age=0; path=/`;
    for (const domain of cookieDomains(location.hostname)) {
      document.cookie = `${name}=; Max-Age=0; path=/; domain=${domain}`;
    }
  }
}

const measurementId = parseMeasurementId(
  document.querySelector('meta[name="ga-measurement-id"]')?.getAttribute('content'),
);
const listeners = new Set<(banner: Banner) => void>();
let state: State = { decision: readDecision(), reviewing: false };

function apply(previous: State | null): void {
  const allowed = state.decision === 'granted';
  if (measurementId) syncAnalytics(measurementId, allowed);
  if (!allowed) purgeAnalyticsCookies();
  const banner = bannerOf(state);
  if (previous && bannerOf(previous) === banner) return;
  for (const listener of listeners) listener(banner);
}

function dispatch(event: ConsentEvent): void {
  const previous = state;
  state = next(state, event);
  if (event.type === 'chose') writeChoice(event.choice);
  apply(previous);
}

export function choose(choice: Choice): void {
  dispatch({ type: 'chose', choice });
}

export function reopen(): void {
  dispatch({ type: 'reopened' });
}

export function watchBanner(listener: (banner: Banner) => void): void {
  listeners.add(listener);
  listener(bannerOf(state));
}

apply(null);
