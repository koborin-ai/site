import 'package:checks/checks.dart';
import 'package:stars_digest/src/pipeline/persona_builder.dart';
import 'package:test/test.dart';

void main() {
  test('stripMdx removes frontmatter, imports and JSX tags', () {
    const mdx = '''
---
title: t
publishedAt: 2026-01-01
---

import Foo from '../Foo.astro';

<Foo prop="x" />

本文テキスト。
<div class="hero">中の文</div>
''';
    final out = stripMdx(mdx);
    check(out).not((it) => it.contains('title: t'));
    check(out).not((it) => it.contains('import Foo'));
    check(out).not((it) => it.contains('<Foo'));
    check(out).not((it) => it.contains('<div'));
    check(out).contains('本文テキスト。');
    check(out).contains('中の文');
  });

  test('buildPersona combines index (stack) and life (character)', () {
    final p = buildPersona(
      indexMdx: '---\ntitle: x\n---\nGoogle Cloud と Genkit が主力。',
      lifeMdx: const ['---\ntitle: y\n---\n全てのことに意味がある。'],
      steering: '簡潔に。',
    );
    check(p.stack).contains('Genkit');
    check(p.character).contains('意味がある');
    check(p.steering).equals('簡潔に。');
  });
}
