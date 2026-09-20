import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { fromMarkdown } from 'mdast-util-from-markdown';
import { gfmFromMarkdown } from 'mdast-util-gfm';
import { gfm } from 'micromark-extension-gfm';
import type { Root, Heading, PhrasingContent } from 'mdast';
import type { SpecFilter } from '../types.js';
import type { MarkdownAst, RequirementNode, SpecSectionNode } from './types.js';

export interface SpecSection {
  readonly title: string;
  readonly level: number;
  readonly content: string;
  readonly requirementIds: readonly string[];
  readonly tags: readonly string[];
}

export interface ParsedSpec {
  readonly filePath: string;
  readonly rawContent: string;
  readonly sections: readonly SpecSection[];
  readonly requirements: readonly RequirementNode[];
  readonly filteredText: string;
  readonly ast: MarkdownAst;
}

const DEFAULT_REQUIREMENT_PREFIXES = ['REQ-', 'AC-'];

/**
 * Builds regex patterns for requirement ID extraction.
 */
export function buildRequirementPatterns(prefixes: readonly string[]): RegExp[] {
  const unique = prefixes.length > 0 ? prefixes : DEFAULT_REQUIREMENT_PREFIXES;
  return unique.map((prefix) => new RegExp(`\\b(${escapeRegex(prefix)}[A-Z0-9_-]+)\\b`, 'gi'));
}

/**
 * Extracts requirement IDs (e.g. REQ-AUTH-01, AC-GDPR-02) from text.
 */
export function extractRequirementIds(text: string, prefixes?: string | readonly string[]): string[] {
  const prefixList =
    prefixes === undefined
      ? DEFAULT_REQUIREMENT_PREFIXES
      : typeof prefixes === 'string'
        ? [prefixes]
        : prefixes;
  const patterns = buildRequirementPatterns(prefixList);
  const matches = new Set<string>();

  for (const regex of patterns) {
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      matches.add(match[1]);
    }
  }

  return Array.from(matches).sort();
}

/**
 * Extracts hashtag-style tags from markdown text.
 */
export function extractTags(text: string): string[] {
  const tags = new Set<string>();
  const tagRegex = /(?:^|\s)#([a-zA-Z][\w-]*)/g;
  let match: RegExpExecArray | null;
  while ((match = tagRegex.exec(text)) !== null) {
    tags.add(match[1].toLowerCase());
  }
  return Array.from(tags);
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function phrasingToText(nodes: PhrasingContent[] | undefined): string {
  if (!nodes) {
    return '';
  }

  return nodes
    .map((node) => {
      if (node.type === 'text') {
        return node.value;
      }
      if ('children' in node && Array.isArray(node.children)) {
        return phrasingToText(node.children as PhrasingContent[]);
      }
      return '';
    })
    .join('');
}

/**
 * Parses markdown into an mdast tree.
 */
export function parseMarkdownAst(content: string): Root {
  return fromMarkdown(content, {
    extensions: [gfm()],
    mdastExtensions: [gfmFromMarkdown()],
  });
}

function detectRequirementPrefix(id: string, prefixes: readonly string[]): string {
  const match = prefixes.find((prefix) => id.toUpperCase().startsWith(prefix.toUpperCase()));
  return match ?? prefixes[0] ?? 'REQ-';
}

/**
 * Walks mdast headings and builds structured sections with requirement metadata.
 */
export function buildSectionsFromAst(tree: Root, prefixes: readonly string[]): SpecSectionNode[] {
  const sections: SpecSectionNode[] = [];
  let currentTitle: string | null = null;
  let currentLevel = 1;
  let currentBlocks: string[] = [];
  let currentStartLine: number | undefined;

  const flush = (): void => {
    if (currentTitle === null) {
      return;
    }

    const content = currentBlocks.join('\n\n').trim();
    const requirementIds = extractRequirementIds(`${currentTitle}\n${content}`, prefixes);
    const tags = extractTags(`${currentTitle}\n${content}`);
    const requirements = requirementIds.map((id) => ({
      id,
      prefix: detectRequirementPrefix(id, prefixes),
      title: currentTitle!,
      content,
      tags,
    }));

    sections.push({
      title: currentTitle,
      level: currentLevel,
      content,
      requirementIds,
      tags,
      requirements,
      startLine: currentStartLine,
    });
    currentBlocks = [];
  };

  for (const node of tree.children) {
    if (node.type === 'heading') {
      flush();
      const heading = node as Heading;
      currentTitle = phrasingToText(heading.children).trim() || 'Untitled Section';
      currentLevel = heading.depth;
      currentStartLine = heading.position?.start.line;
      continue;
    }

    if (currentTitle === null) {
      currentTitle = 'Document Header';
      currentLevel = 1;
    }

    const serialized = serializeNode(node);
    if (serialized.trim()) {
      currentBlocks.push(serialized);
    }
  }

  flush();
  return sections;
}

function serializeNode(node: unknown): string {
  if (!node || typeof node !== 'object') {
    return '';
  }

  const typed = node as { type?: string; value?: string; children?: unknown[] };
  if (typed.type === 'text' && typed.value) {
    return typed.value;
  }
  if (typed.type === 'inlineCode' && typed.value) {
    return `\`${typed.value}\``;
  }
  if (typed.type === 'code' && typed.value) {
    return `\`\`\`\n${typed.value}\n\`\`\``;
  }
  if (typed.type === 'paragraph' || typed.type === 'listItem') {
    return (typed.children ?? []).map((child) => serializeNode(child)).join('');
  }
  if (typed.type === 'list') {
    return (typed.children ?? [])
      .map((child) => `- ${serializeNode(child)}`)
      .join('\n');
  }
  if (typed.type === 'table') {
    return '[table omitted]';
  }
  if (typed.children) {
    return typed.children.map((child) => serializeNode(child)).join('');
  }
  return '';
}

/**
 * Parses markdown into structured sections by heading (legacy-compatible API).
 */
export function parseMarkdownSections(content: string, prefixes?: string | readonly string[]): SpecSection[] {
  const prefixList =
    prefixes === undefined
      ? DEFAULT_REQUIREMENT_PREFIXES
      : typeof prefixes === 'string'
        ? [prefixes]
        : prefixes;
  const tree = parseMarkdownAst(content);
  return buildSectionsFromAst(tree, prefixList).map((section) => ({
    title: section.title,
    level: section.level,
    content: section.content,
    requirementIds: section.requirementIds,
    tags: section.tags,
  }));
}

function resolveRequirementPrefixes(filter?: SpecFilter): string[] {
  if (filter?.requirementPrefix) {
    return [filter.requirementPrefix, 'AC-'];
  }
  return DEFAULT_REQUIREMENT_PREFIXES;
}

function sectionMatchesTags(section: SpecSectionNode, tags?: readonly string[]): boolean {
  if (!tags || tags.length === 0) {
    return true;
  }
  const wanted = new Set(tags.map((tag) => tag.toLowerCase()));
  return section.tags.some((tag) => wanted.has(tag.toLowerCase()));
}

function sectionMatchesHeadings(section: SpecSectionNode, headings?: readonly string[]): boolean {
  if (!headings || headings.length === 0) {
    return true;
  }
  const wanted = new Set(headings.map((heading) => heading.toLowerCase()));
  return wanted.has(section.title.toLowerCase());
}

function sectionMatchesRequirementPrefix(
  section: SpecSectionNode,
  prefixes: readonly string[]
): boolean {
  if (prefixes.length === DEFAULT_REQUIREMENT_PREFIXES.length) {
    return true;
  }
  return section.requirementIds.some((id) =>
    prefixes.some((prefix) => id.toUpperCase().startsWith(prefix.toUpperCase()))
  );
}

/**
 * Applies spec filters including headings, tags, and requirement prefixes.
 */
export function filterSections(
  sections: readonly SpecSectionNode[],
  filter?: SpecFilter
): SpecSectionNode[] {
  const prefixes = resolveRequirementPrefixes(filter);

  return sections.filter(
    (section) =>
      sectionMatchesHeadings(section, filter?.headings) &&
      sectionMatchesTags(section, filter?.tags) &&
      sectionMatchesRequirementPrefix(section, prefixes)
  );
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
  const prefixes = resolveRequirementPrefixes(filter);
  const tree = parseMarkdownAst(rawContent);
  const allSections = buildSectionsFromAst(tree, prefixes);
  const filteredSections = filterSections(allSections, filter);
  const requirements = filteredSections.flatMap((section) => section.requirements);

  const filteredText =
    filteredSections.length > 0
      ? filteredSections
          .map((section) => {
            const ids =
              section.requirementIds.length > 0
                ? ` [${section.requirementIds.join(', ')}]`
                : '';
            return `### ${section.title}${ids}\n${section.content}`;
          })
          .join('\n\n')
      : rawContent;

  return {
    filePath: absolutePath,
    rawContent,
    sections: filteredSections.map((section) => ({
      title: section.title,
      level: section.level,
      content: section.content,
      requirementIds: section.requirementIds,
      tags: section.tags,
    })),
    requirements,
    filteredText,
    ast: {
      tree,
      sections: filteredSections,
      requirements,
    },
  };
}
