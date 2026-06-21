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

  test('extractSections splits level-2 headings', () {
    const mdx = '''
---
title: x
---

## Who runs this
Google Cloud パートナー

### 経歴
2019 年卒

## プロジェクト実績
| 年 | プロジェクト |
|----|--------------|
| 2024 | OPA 認可基盤 |
''';
    final sections = extractSections(mdx);
    check(sections.keys).contains('Who runs this');
    check(sections.keys).contains('プロジェクト実績');
    check(sections['Who runs this']!).contains('Google Cloud パートナー');
    check(sections['Who runs this']!).contains('2019 年卒');
    check(sections['プロジェクト実績']!).contains('OPA 認可基盤');
  });

  test('buildStackProfile prioritizes project deliverables over building', () {
    const mdx = '''
---
title: x
---

## Who runs this
サーバーレス開発が専門

## プロジェクト実績
Cloud Run + OPA 認可基盤

## Building
contextlint — AI 時代の Markdown リンター
''';
    final profile = buildStackProfile(mdx);
    final projectPos = profile.indexOf('案件で扱ってきた技術スタック・ドメイン');
    final buildingPos = profile.indexOf('個人で探求中のテーマ');
    check(projectPos).isGreaterThan(-1);
    check(buildingPos).isGreaterThan(-1);
    check(projectPos).isLessThan(buildingPos);
    check(profile).contains('Cloud Run + OPA 認可基盤');
    check(profile).contains('補助的参考');
  });

  test('buildPersona combines index (stack) and life (character)', () {
    final p = buildPersona(
      indexMdx: '''
---
title: x
---

## Who runs this
Google Cloud と Genkit が主力。

## プロジェクト実績
Cloud Run 案件
''',
      lifeMdx: const ['---\ntitle: y\n---\n全てのことに意味がある。'],
      steering: '簡潔に。',
    );
    check(p.stack).contains('Genkit');
    check(p.stack).contains('Cloud Run 案件');
    check(p.stack).contains('案件で扱ってきた技術スタック・ドメイン');
    check(p.character).contains('意味がある');
    check(p.steering).equals('簡潔に。');
  });
}
