import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { SpecFilter } from '../types.js';

export interface SpecSection {
  readonly title: string;
  readonly level: number;
  readonly content: string;
  readonly requirementIds: readonly string[];
}

export interface ParsedSpec {
  readonly filePath: string;
  readonly rawContent: string;
  readonly sections: readonly SpecSection[];
  readonly filteredText: string;
}

/**
 * Extracts requirement IDs (e.g. REQ-AUTH-01, AC-02) from text.
 */
export function extractRequirementIds(text: string, prefix = 'REQ-'): string[] {
  const regex = new RegExp(`\\b(${prefix}[A-Z0-9_-]+)\\b`, 'gi');
  const matches = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    matches.add(match[1]);
  }
  return Array.from(matches);
}

/**
 * Parses markdown into structured sections by heading.
 */
export function parseMarkdownSections(content: string, prefix = 'REQ-'): SpecSection[] {
  const lines = content.split('\n');
  const sections: SpecSection[] = [];
  let currentTitle = 'Document Header';
  let currentLevel = 1;
  let currentLines: string[] = [];

  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      if (currentLines.length > 0) {
        const text = currentLines.join('\n').trim();
        sections.push({
          title: currentTitle,
          level: currentLevel,
          content: text,
          requirementIds: extractRequirementIds(text, prefix),
        });
        currentLines = [];
      }
      currentLevel = headingMatch[1].length;
      currentTitle = headingMatch[2].trim();
    } else {
      currentLines.push(line);
    }
  }

  if (currentLines.length > 0) {
    const text = currentLines.join('\n').trim();
    sections.push({
      title: currentTitle,
      level: currentLevel,
      content: text,
      requirementIds: extractRequirementIds(text, prefix),
    });
  }

  return sections;
}

/**
 * Loads and slices a markdown specification file based on filters.
 */
export async function loadSpec(
  filePath: string,
  cwd: string = process.cwd(),
  filter?: SpecFilter
): Promise<ParsedSpec> {
  const absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(cwd, filePath);
  const rawContent = await fs.readFile(absolutePath, 'utf-8');

  const reqPrefix = filter?.requirementPrefix ?? 'REQ-';
  const sections = parseMarkdownSections(rawContent, reqPrefix);

  let filteredSections = sections;
  if (filter?.headings && filter.headings.length > 0) {
    const headingSet = new Set(filter.headings.map((h) => h.toLowerCase()));
    filteredSections = sections.filter((s) => headingSet.has(s.title.toLowerCase()));
  }

  const filteredText =
    filteredSections.length > 0
      ? filteredSections.map((s) => `### ${s.title}\n${s.content}`).join('\n\n')
      : rawContent;

  return {
    filePath: absolutePath,
    rawContent,
    sections: filteredSections,
    filteredText,
  };
}
