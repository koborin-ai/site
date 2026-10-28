const GRID = 32;
const INK = { x: 6, y: 8, width: 20.5, height: 20 } as const;
const TILE_BACKGROUND = '#0b0d12';
const TILE_INK = '#d5dae1';

interface MarkFrame {
  readonly markup: string;
  readonly width: number;
  readonly height: number;
}

function shapes(paint: string): string {
  return [
    `<path d="M8 15 A5 5 0 0 1 18 15 V24" fill="none" stroke="${paint}" stroke-width="4" stroke-linecap="butt"/>`,
    `<rect x="6" y="18" width="4" height="10" fill="${paint}"/>`,
    `<rect x="21.5" y="19" width="5" height="5" fill="${paint}"/>`,
  ].join('');
}

function lockup(height: number, paint: string): MarkFrame {
  const width = Math.round((INK.width / INK.height) * height * 100) / 100;
  const markup = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${INK.x} ${INK.y} ${INK.width} ${INK.height}" width="${width}" height="${height}" aria-hidden="true">${shapes(paint)}</svg>`;
  return { markup, width, height };
}

export function headerMark(): MarkFrame {
  return lockup(18, 'currentColor');
}

export function ogMark(): MarkFrame {
  return lockup(26, TILE_INK);
}

export function tileSvg(px: number, corners: 'rounded' | 'square'): string {
  const radius = corners === 'rounded' ? ' rx="6"' : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${GRID} ${GRID}" width="${px}" height="${px}"><rect width="${GRID}" height="${GRID}"${radius} fill="${TILE_BACKGROUND}"/>${shapes(TILE_INK)}</svg>`;
}
