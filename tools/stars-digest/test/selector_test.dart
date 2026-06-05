import 'package:checks/checks.dart';
import 'package:stars_digest/src/domain/models.dart';
import 'package:stars_digest/src/pipeline/selector.dart';
import 'package:test/test.dart';

List<Repo> repos(List<String> ids) => [
  for (final id in ids)
    Repo(id: id, url: 'https://x/$id', category: 'c', description: 'd'),
];

void main() {
  final all = repos(['a/1', 'b/2', 'c/3', 'd/4', 'e/5', 'f/6']);

  test('main is a non-featured repo; new arrivals become subs', () {
    final sel = selectEdition(
      repos: all,
      newArrivalIds: {'e/5', 'f/6'},
      featuredIds: {'a/1'},
      dateSeed: '2026-05-31',
      maxSubs: 5,
    );
    check(sel.main.id).not((it) => it.equals('a/1'));
    check({for (final s in sel.subs) s.id}).unorderedEquals({'e/5', 'f/6'});
    check(sel.overflow).isEmpty();
  });

  test('main pick is deterministic for the same dateSeed', () {
    final a = selectEdition(
      repos: all,
      newArrivalIds: {},
      featuredIds: {},
      dateSeed: '2026-05-31',
    );
    final b = selectEdition(
      repos: all,
      newArrivalIds: {},
      featuredIds: {},
      dateSeed: '2026-05-31',
    );
    check(a.main.id).equals(b.main.id);
  });

  test('subs are capped at maxSubs; rest go to overflow', () {
    final sel = selectEdition(
      repos: all,
      newArrivalIds: {'a/1', 'b/2', 'c/3', 'd/4', 'e/5'},
      featuredIds: {},
      dateSeed: 's',
      maxSubs: 3,
    );
    check(sel.subs).length.equals(3);
    check(sel.overflow).length.equals(2);
    final shown = {
      sel.main.id,
      ...sel.subs.map((r) => r.id),
      ...sel.overflow.map((r) => r.id),
    };
    check(shown).length.equals(1 + 3 + 2);
  });
}
