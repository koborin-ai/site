import { describe, test as it } from 'node:test';
import { fileURLToPath } from 'node:url';
import * as path from 'node:path';
import { expect } from './test-utils.js';
import { parseUnifiedDiff, formatDiffContext } from '../src/context/git-diff.js';
import { resolveGlobPatterns, matchesGlobPatterns } from '../src/context/glob-matcher.js';
import { extractCodeContext } from '../src/context/code-extractor.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pkgRoot = path.resolve(__dirname, '../..');

const SAMPLE_DIFF = `diff --git a/test/fixtures/src/auth.ts b/test/fixtures/src/auth.ts
index 1111111..2222222 100644
--- a/test/fixtures/src/auth.ts
+++ b/test/fixtures/src/auth.ts
@@ -1,3 +1,4 @@
 export interface SessionPayload {
   userId: string;
+  role: string;
   tokenId: string;
 }
`;

describe('Git diff and code extraction', () => {
  it('parses unified diff output', () => {
    const files = parseUnifiedDiff(SAMPLE_DIFF);
    expect(files).toHaveLength(1);
    expect(files[0].relativePath).toBe('test/fixtures/src/auth.ts');
    expect(files[0].hunks.length).toBeGreaterThan(0);
    expect(formatDiffContext(files)).toContain('role: string');
  });

  it('resolves fixture globs and reads files', async () => {
    const matches = await resolveGlobPatterns(['test/fixtures/src/**/*.ts'], pkgRoot);
    expect(matches.length).toBeGreaterThan(0);

    const context = await extractCodeContext(['test/fixtures/src/**/*.ts'], { cwd: pkgRoot });
    expect(context.mode).toBe('full');
    expect(context.files.length).toBeGreaterThan(0);
    expect(context.combinedPromptContext).toContain('SessionService');
  });

  it('matches glob include and ignore patterns', () => {
    expect(
      matchesGlobPatterns('test/fixtures/src/auth.ts', ['test/fixtures/src/**/*.ts'])
    ).toBe(true);
    expect(
      matchesGlobPatterns('test/fixtures/src/auth.test.ts', [
        'test/fixtures/src/**/*.ts',
        '!test/fixtures/src/**/*.test.ts',
      ])
    ).toBe(false);
  });
});
