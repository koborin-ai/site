import 'package:checks/checks.dart';
import 'package:stars_digest/stars_digest.dart';
import 'package:test/test.dart';

void main() {
  test(
    'StubDigestModel returns stub content matching the selection subs',
    () async {
      const main = Repo(
        id: 'a/main',
        url: 'u',
        category: 'c',
        description: 'main desc',
      );
      const sub = Repo(
        id: 'b/sub',
        url: 'u2',
        category: 'c',
        description: 'sub desc',
      );
      final e = await StubDigestModel().generate(
        persona: const Persona(stack: 's', character: 'c', steering: ''),
        selection: const Selection(main: main, subs: [sub], overflow: []),
        dateJst: '2026-05-31',
      );
      check(e.title).contains('2026-05-31');
      check(e.main.whatItIs).equals('main desc');
      check(e.subs).length.equals(1);
      check(e.subs.single.oneLine).equals('sub desc');
    },
  );
}
