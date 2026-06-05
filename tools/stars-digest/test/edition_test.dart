import 'package:checks/checks.dart';
import 'package:stars_digest/src/domain/edition.dart';
import 'package:test/test.dart';

void main() {
  test('Edition round-trips via json', () {
    final e = Edition(
      title: 'タイトル',
      intro: 'イントロ',
      main: MainContent(
        hook: 'フック',
        whatItIs: '何か',
        whyItResonates: '接点',
        useCases: ['u1', 'u2'],
        firstStep: '一歩',
      ),
      subs: [SubContent(oneLine: 's1', hook: 'h1')],
    );
    final parsed = Edition.fromJson(e.toJson());
    check(parsed.title).equals('タイトル');
    check(parsed.main.useCases).deepEquals(['u1', 'u2']);
    check(parsed.subs.single.oneLine).equals('s1');
  });

  test('schema is exposed for genkit outputSchema', () {
    check(Edition.$schema).isNotNull();
  });
}
