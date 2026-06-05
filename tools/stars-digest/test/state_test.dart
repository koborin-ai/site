import 'package:checks/checks.dart';
import 'package:stars_digest/src/domain/state.dart';
import 'package:test/test.dart';

void main() {
  test('round-trips through json with defaults', () {
    const s = DigestState(mainFeatured: {'a/1'}, lastProcessedStarsSha: 'abc');
    final parsed = DigestState.fromJson(s.toJson());
    check(parsed.mainFeatured).unorderedEquals({'a/1'});
    check(parsed.lastProcessedStarsSha).equals('abc');
  });

  test('empty json yields empty state', () {
    final s = DigestState.fromJson(const {});
    check(s.mainFeatured).isEmpty();
    check(s.lastProcessedStarsSha).isNull();
  });

  test('withMainFeatured adds id and updates sha immutably', () {
    const s = DigestState(mainFeatured: {'a/1'}, lastProcessedStarsSha: 'old');
    final n = s.withMainFeatured('b/2', sha: 'new');
    check(n.mainFeatured).unorderedEquals({'a/1', 'b/2'});
    check(n.lastProcessedStarsSha).equals('new');
    check(s.mainFeatured).unorderedEquals({'a/1'});
  });
}
