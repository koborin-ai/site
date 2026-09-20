import { describe, test as it } from 'node:test';
import { fileURLToPath } from 'node:url';
import * as path from 'node:path';
import { expect } from './test-utils.js';
import {
  loadSpec,
  parseMarkdownSections,
  extractRequirementIds,
  extractTags,
  filterSections,
  buildSectionsFromAst,
  parseMarkdownAst,
} from '../src/parser/markdown-parser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pkgRoot = path.resolve(__dirname, '../..');

describe('Markdown Spec Parser', () => {
  it('extracts REQ and AC requirement IDs', () => {
    const text = 'REQ-AUTH-01 and AC-GDPR-02 with REQ-DATA_02';
    const ids = extractRequirementIds(text);
    expect(ids).toContain('REQ-AUTH-01');
    expect(ids).toContain('AC-GDPR-02');
    expect(ids).toContain('REQ-DATA_02');
  });

  it('extracts hashtag tags', () => {
    const tags = extractTags('Security notes #auth #compliance');
    expect(tags).toContain('auth');
    expect(tags).toContain('compliance');
  });

  it('parses markdown sections via mdast', () => {
    const markdown = `# Title
Intro text

## REQ-01 Section
Details for REQ-01.

## REQ-02 Section
Details for REQ-02.
`;
    const sections = parseMarkdownSections(markdown);
    expect(sections.length).toBeGreaterThanOrEqual(2);
    expect(sections.some((section) => section.title.includes('REQ-01'))).toBe(true);
  });

  it('filters sections by heading, tag, and requirement prefix', () => {
    const tree = parseMarkdownAst(`# Overview

## Authentication
REQ-AUTH-01 details. #auth

## Billing
REQ-BILL-01 details. #billing
`);
    const sections = buildSectionsFromAst(tree, ['REQ-', 'AC-']);
    const filtered = filterSections(sections, {
      headings: ['Authentication'],
      tags: ['auth'],
      requirementPrefix: 'REQ-AUTH-',
    });

    expect(filtered).toHaveLength(1);
    expect(filtered[0].title).toBe('Authentication');
    expect(filtered[0].requirementIds).toContain('REQ-AUTH-01');
  });

  it('loads and filters spec file from fixture', async () => {
    const fixturePath = path.resolve(pkgRoot, 'test/fixtures/specs/auth-requirements.md');
    const parsed = await loadSpec(fixturePath, pkgRoot, {
      requirementPrefix: 'REQ-AUTH-',
    });

    expect(parsed.sections.length).toBeGreaterThan(0);
    expect(parsed.requirements.length).toBeGreaterThan(0);
    expect(parsed.filteredText).toContain('REQ-AUTH-01');
    expect(parsed.filteredText).toContain('REQ-AUTH-02');
    expect(parsed.ast.tree.type).toBe('root');
  });
});
