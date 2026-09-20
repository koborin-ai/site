import { describe, test as it } from 'node:test';
import { fileURLToPath } from 'node:url';
import * as path from 'node:path';
import { expect } from './test-utils.js';
import { loadSpec, parseMarkdownSections, extractRequirementIds } from '../src/parser/markdown-parser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Markdown Spec Parser', () => {
  it('extracts requirement IDs correctly', () => {
    const text = 'Here is REQ-AUTH-01 and also REQ-DATA_02, plus non-matching REQ.';
    const ids = extractRequirementIds(text, 'REQ-');
    expect(ids).toContain('REQ-AUTH-01');
    expect(ids).toContain('REQ-DATA_02');
  });

  it('parses markdown sections by headings', () => {
    const markdown = `# Title
Intro text

## REQ-01 Section
Details for REQ-01.

## REQ-02 Section
Details for REQ-02.
`;
    const sections = parseMarkdownSections(markdown, 'REQ-');
    expect(sections.length).toBeGreaterThanOrEqual(2);
    expect(sections[1].title).toBe('REQ-01 Section');
    expect(sections[1].requirementIds).toContain('REQ-01');
  });

  it('loads and filters spec file from fixture', async () => {
    // Resolve relative to package root instead of compiled __dirname
    const pkgRoot = path.resolve(__dirname, '../..');
    const fixturePath = path.resolve(pkgRoot, 'test/fixtures/specs/auth-requirements.md');
    const parsed = await loadSpec(fixturePath, pkgRoot, {
      requirementPrefix: 'REQ-AUTH-',
    });

    expect(parsed.sections.length).toBeGreaterThan(0);
    expect(parsed.filteredText).toContain('REQ-AUTH-01');
    expect(parsed.filteredText).toContain('REQ-AUTH-02');
  });
});
