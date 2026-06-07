import 'package:checks/checks.dart';
import 'package:stars_digest/src/domain/edition.dart';
import 'package:stars_digest/src/domain/models.dart';
import 'package:stars_digest/src/pipeline/render.dart';
import 'package:test/test.dart';

RepoRef ref(String id) => RepoRef(
  id: id,
  url: 'https://github.com/$id',
  category: '🤖 AI Frameworks',
  language: 'Dart',
  stars: 10,
);

Edition edition() => Edition(
  title: '今日のタイトル',
  intro: 'イントロ文。',
  main: MainContent(
    hook: 'フック',
    whatItIs: '何か説明',
    whyItResonates: '接点説明',
    useCases: ['活用1', '活用2'],
    firstStep: 'まず試す',
  ),
  subs: [SubContent(oneLine: 'サブ説明', hook: 'サブ活用')],
);

DigestResult result({Edition? e, String dateJst = '2026-05-31'}) =>
    DigestResult(
      dateJst: dateJst,
      edition: e ?? edition(),
      main: ref('main/repo'),
      subs: [ref('sub/one')],
      overflow: [ref('extra/two')],
    );

void main() {
  test('renderEdition emits frontmatter, sections, links and footer', () {
    final md = renderEdition(result());
    check(md).startsWith('---\n');
    check(md).contains('title: "今日のタイトル"');
    check(md).contains('publishedAt: 2026-05-31');
    check(md).contains('draft: false');
    check(md).contains('lastUpdated: false');
    check(md).contains('https://github.com/main/repo');
    check(md).contains('活用1');
    check(md).contains('https://github.com/sub/one');
    check(md).contains('extra/two');
    check(md).contains('starmap × Genkit (Dart) + Gemini');
  });

  test('renderIndex lists editions newest first with intro', () {
    final md = renderIndex(
      editions: const [
        EditionMeta(dateJst: '2026-05-30', title: '古い号', description: 'd1'),
        EditionMeta(dateJst: '2026-05-31', title: '新しい号', description: 'd2'),
      ],
    );
    check(md).contains('starmap × Genkit (Dart) + Gemini');
    final iNew = md.indexOf('2026-05-31');
    final iOld = md.indexOf('2026-05-30');
    check(iNew < iOld).isTrue();
    check(md).contains('/stars/2026-05-31/');
    check(md).contains('## Editions');
  });

  test('editionMetaFrom derives description from intro', () {
    final meta = editionMetaFrom(result());
    check(meta.title).equals('今日のタイトル');
    check(meta.description).contains('イントロ');
  });

  test('renderEdition escapes frontmatter (newlines, quotes, backslashes)', () {
    final e = Edition(
      title: 'タイトル "引用"\n改行 \\バックスラッシュ',
      intro: '1行目\n2行目',
      main: MainContent(
        hook: 'h',
        whatItIs: 'w',
        whyItResonates: 'r',
        useCases: ['u'],
        firstStep: 'f',
      ),
      subs: const [],
    );
    final md = renderEdition(
      DigestResult(
        dateJst: '2026-05-31',
        edition: e,
        main: ref('m/x'),
        subs: const [],
        overflow: const [],
      ),
    );
    check(md).contains(r'\"引用\"'); // double-quotes escaped
    check(md).contains(r'\\'); // backslash escaped
    check(md).contains('description: "1行目 2行目"'); // newline collapsed
  });
}
