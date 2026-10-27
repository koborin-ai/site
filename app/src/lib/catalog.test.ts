import { describe, expect, it } from 'vitest';
import {
  bio,
  book,
  groupByYear,
  formatPostDate,
  formatTalkDate,
  homeLimit,
  homeTalks,
  isAboutId,
  isHomeId,
  linkLabel,
  listHref,
  projects,
  talks,
  writingPosts,
} from './catalog';

describe('home catalog', () => {
  it('keeps the project order and the TerraDart lines', () => {
    expect(projects.map((project) => project.name)).toEqual([
      'TerraDart',
      'contextlint',
      'gcp-cost-mcp-server',
      'ableton-osc-mcp',
      'jev-spec',
    ]);
    expect(projects[0]?.description.ja).toBe('Dart のためのタイプセーフな IaC。');
    expect(projects[0]?.description.en).toBe('Type-safe IaC for Dart.');
    expect(projects[2]?.description.ja).toBe('AI アシスタントから GCP のランニングコストを見積もれる MCP サーバー。');
    expect(projects[2]?.description.en).toBe('An MCP server that lets AI assistants estimate GCP running costs.');
    expect(projects[3]?.description.ja).toBe('AbletonOSC 経由で Ableton Live を操作できる MCP サーバー。');
    expect(projects[3]?.description.en).toBe('An MCP server that drives Ableton Live via AbletonOSC.');
    expect(projects.map((project) => project.icon)).toEqual(['terradart', 'contextlint', 'g', 'a', 'j']);
    expect(bio.ja.before + 'TerraDart' + bio.ja.after).toBe(
      'ソフトウェアエンジニア。開発者向けのツールを公開しながら作っていて、いまはTerraDartに取り組んでいます。',
    );
    expect(bio.en.before + 'TerraDart' + bio.en.after).toBe(
      "Software engineer. I build developer tools in the open, and right now that's TerraDart.",
    );
    expect(book.note.ja).toBe('Xavier Portilla 氏との共著。');
    expect(book.note.en).toBe('Co-authored with Xavier Portilla.');
  });

  it('keeps every talk, including the hands-on', () => {
    expect(talks).toHaveLength(12);
    expect(talks[0]?.event.ja).toBe('第10回 FlutterGakkai');
    expect(talks.map((item) => item.event.ja)).toContain('Genkit ハンズオン（運営）');
    expect(talks.map((item) => ({ date: item.date, event: item.event.en, attendees: item.attendees }))).toEqual([
      { date: '2026/07', event: 'FlutterGakkai (10th)', attendees: 56 },
      { date: '2025/07', event: 'Google I/O Extended Tokyo 2025', attendees: 434 },
      { date: '2025/02', event: 'FlutterGakkai (7th)', attendees: 191 },
      { date: '2024/12', event: 'Genkit Hands-on (Organizer)', attendees: 45 },
      { date: '2024/11', event: 'GDG DevFest Tokyo 2024', attendees: 369 },
      { date: '2024/06', event: 'TECH+ Seminar', attendees: 246 },
      { date: '2024/06', event: 'Map The Way Tokyo', attendees: 75 },
      { date: '2024/04', event: 'Retail DX', attendees: 138 },
      { date: '2024/04', event: 'Google Cloud RetailTech Recap Seminar', attendees: 51 },
      { date: '2024/03', event: 'RetailTech JAPAN', attendees: 429 },
      { date: '2024/02', event: 'GDG Tokyo Monthly Online Tech Talks', attendees: 200 },
      { date: '2023/12', event: 'Cloud Ace Webinar', attendees: 61 },
    ]);
    expect(talks.slice(0, homeLimit).map((item) => item.date)).toEqual([
      '2026/07',
      '2025/07',
      '2025/02',
      '2024/12',
    ]);
    expect(homeTalks().map((item) => item.date)).toEqual(['2026/07', '2025/07', '2025/02', '2024/11']);
    expect(formatTalkDate('2026/07', 'list')).toBe('07月');
    expect(formatPostDate(new Date('2026-09-22T00:00:00.000Z'), 'list')).toBe('09/22');
  });

  it('lists published posts newest first and skips drafts', () => {
    const posts = writingPosts(
      [
        { id: 'tech/older', data: { title: 'Older', publishedAt: new Date('2026-01-02') } },
        { id: 'life/newer', data: { title: 'Newer', publishedAt: new Date('2026-09-12') } },
        { id: 'life/draft', data: { title: 'Draft', publishedAt: new Date('2026-12-01'), draft: true } },
        { id: 'privacy-policy', data: { title: 'Privacy', publishedAt: new Date('2026-08-01') } },
        { id: 'ja/tech/older', data: { title: '古い', publishedAt: new Date('2026-01-02') } },
      ],
      'en',
    );

    expect(posts.map((post) => post.title)).toEqual(['Newer', 'Older']);
    expect(posts[0]?.href).toBe('/life/newer/');
    expect(groupByYear(posts).map((group) => group.year)).toEqual([2026]);
    expect(listHref('writing', 'ja')).toBe('/ja/blog/');
    expect(listHref('talks', 'en')).toBe('/talks/');
    expect(linkLabel.all.ja).toBe('すべて →');
    expect(isHomeId('ja')).toBe(true);
    expect(isHomeId('about')).toBe(false);
    expect(isAboutId('about')).toBe(true);
    expect(isAboutId('ja/about')).toBe(true);
    expect(isAboutId('ja/tech/older')).toBe(false);
  });
});
