import 'package:checks/checks.dart';
import 'package:genkit/genkit.dart';
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
  test(
    'flow returns a DigestResult with new arrival as sub and backlog main',
    () async {
      final txt =
          '## 🛠️ Dev Tools\n\n- [a/new](https://github.com/a/new): n\n- [b/old](https://github.com/b/old): o\n';
      final baseline = '- [b/old](https://github.com/b/old): o\n';
      final stars = _FakeStars(txt, '', baseline);

      final ai = Genkit();
      final flow = defineStarsDigestFlow(
        ai,
        StarsDigestDeps(
          stars: stars,
          indexMdx: '---\nt\n---\nスタック',
          lifeMdx: const ['---\nt\n---\n人柄'],
          steering: '',
          // Seed a baseline sha so the diff treats a/new as a new arrival.
          state: const DigestState(lastProcessedStarsSha: 'OLDSHA'),
          model: _FakeModel(),
        ),
      );

      final result = await flow(DigestFlowInput(dateJst: '2026-05-31'));

      check(result.dateJst).equals('2026-05-31');
      // a/new is the new arrival -> it lands in subs.
      check(result.subs.map((r) => r.id)).contains('a/new');
      // main is a backlog pick (excludes new arrivals) -> b/old.
      check(result.main.id).equals('b/old');
      // Edition prose passes through from the model.
      check(result.edition.title).equals('号タイトル');
      check(result.edition.main.hook).equals('h');
    },
  );
}
