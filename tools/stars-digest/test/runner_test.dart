import 'dart:io';
import 'package:checks/checks.dart';
import 'package:genkit/genkit.dart';
import 'package:path/path.dart' as p;
import 'package:stars_digest/stars_digest.dart';
import 'package:test/test.dart';

class _FakeModel implements DigestModel {
  @override
  Future<Edition> generate({
    required Persona persona,
    required Selection selection,
    required String dateJst,
  }) async => Edition(
    title: '号タイトル',
    intro: 'イントロ。',
    main: MainContent(
      hook: 'h',
      whatItIs: 'w',
      whyItResonates: 'r',
      useCases: ['u1'],
      firstStep: 'f',
    ),
    subs: [for (final _ in selection.subs) SubContent(oneLine: 'o', hook: 'k')],
  );
}

class _FakeStars implements StarsRepo {
  final String txt;
  final String full;
  final String? baseline;
  _FakeStars(this.txt, this.full, this.baseline);
  @override
  String headSha() => 'HEADSHA';
  @override
  String readLlmsTxt() => txt;
  @override
  String readLlmsFull() => full;
  @override
  String? showLlmsTxtAt(String sha) => baseline;
}

void main() {
  late Directory tmp;
  setUp(() => tmp = Directory.systemTemp.createTempSync('digest'));
  tearDown(() => tmp.deleteSync(recursive: true));

  test('writes edition + index + state and returns a summary', () async {
    final txt =
        '## 🛠️ Dev Tools\n\n- [a/new](https://github.com/a/new): n\n- [b/old](https://github.com/b/old): o\n';
    final baseline = '- [b/old](https://github.com/b/old): o\n';
    final stars = _FakeStars(txt, '', baseline);

    final contentDir = Directory(p.join(tmp.path, 'docs'))
      ..createSync(recursive: true);
    final stateFile = File(p.join(tmp.path, 'featured.json'));
    // Seed a baseline sha so the diff treats a/new as a new arrival.
    stateFile.writeAsStringSync('{"lastProcessedStarsSha": "OLDSHA"}');

    final summary = await runGenerate(
      ai: Genkit(),
      stars: stars,
      model: _FakeModel(),
      contentDocsDir: contentDir.path,
      stateFile: stateFile.path,
      indexMdx: '---\nt\n---\nスタック',
      lifeMdx: const ['---\nt\n---\n人柄'],
      steering: '',
      dateJst: '2026-05-31',
      maxSubs: 5,
    );

    final edition = File(p.join(contentDir.path, 'stars', '2026-05-31.md'));
    final index = File(p.join(contentDir.path, 'stars', 'index.md'));
    check(edition.existsSync()).isTrue();
    check(index.existsSync()).isTrue();
    check(edition.readAsStringSync()).contains('a/new');
    check(stateFile.readAsStringSync()).contains('lastProcessedStarsSha');
    check(summary).contains('2026-05-31');
  });
}
