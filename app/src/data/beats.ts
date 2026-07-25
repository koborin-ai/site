export interface Beat {
  slug: string;
  title: string;
  description: string;
  /** ISO date YYYY-MM-DD */
  date: string;
  bpm?: number;
  key?: string;
  /** Public path under /audio/beats/ */
  audioSrc: string;
  /** Optional external listen link (YouTube, etc.) */
  externalUrl?: string;
  /** OG image path under /og/ (png or jpeg; served as webp in production) */
  ogImage?: string;
}

/**
 * Beat catalog. Sorted newest-first at read time via getBeats().
 * Add a track here, place the MP3 under public/audio/beats/,
 * add OG art under public/og/ + src/assets/og/, create beats/<slug>.mdx,
 * register the cover in BeatList.astro, and add a sidebar entry under Beats.
 */
export const beats: Beat[] = [
  {
    slug: 'slip-road',
    title: 'Slip Road',
    description:
      'A cold UK drill instrumental built around a sparse intro and heavier verse/hook sections.',
    date: '2026-07-25',
    bpm: 150,
    key: 'C minor',
    audioSrc: '/audio/beats/slip-road.mp3',
    ogImage: '/og/beats-slip-road.jpg',
  },
];

export function getBeats(): Beat[] {
  return [...beats].sort((a, b) => b.date.localeCompare(a.date));
}

export function getBeat(slug: string): Beat | undefined {
  return beats.find((beat) => beat.slug === slug);
}

export function beatPath(slug: string): string {
  return `/beats/${slug}/`;
}
