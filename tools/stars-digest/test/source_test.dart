import 'dart:io';
import 'package:checks/checks.dart';
import 'package:stars_digest/src/pipeline/source.dart';
import 'package:test/test.dart';

void main() {
  final llmsTxt = File('test/fixtures/llms_new.txt').readAsStringSync();
  final llmsFull = File('test/fixtures/llms-full.md').readAsStringSync();

  test('parses repos deduped by id, preferring non-Focus category', () {
    final repos = StarsSource.parse(llmsTxt: llmsTxt, llmsFull: llmsFull);
    final byId = {for (final r in repos) r.id: r};

    check(byId.containsKey('nozomi-koborinai/starmap')).isTrue();
    check(byId['nozomi-koborinai/starmap']!.category).equals('🛠️ Dev Tools');
    check(
      byId['nozomi-koborinai/starmap']!.url,
    ).equals('https://github.com/nozomi-koborinai/starmap');
  });

  test('enriches with language/stars/readme from llms-full', () {
    final repos = StarsSource.parse(llmsTxt: llmsTxt, llmsFull: llmsFull);
    final starmap = repos.firstWhere((r) => r.id == 'nozomi-koborinai/starmap');
    check(starmap.language).equals('Rust');
    check(starmap.stars).equals(5);
    check(starmap.readme).isNotNull().contains('Awesome List');
  });

  test('parses a repo with no description (empty description)', () {
    const txt =
        '## 🛠️ Dev Tools\n\n- [nozomi-koborinai/starmap](https://github.com/nozomi-koborinai/starmap)\n';
    final repos = StarsSource.parse(llmsTxt: txt, llmsFull: '');
    final r = repos.firstWhere((e) => e.id == 'nozomi-koborinai/starmap');
    check(r.description).equals('');
    check(r.url).equals('https://github.com/nozomi-koborinai/starmap');
  });
}
