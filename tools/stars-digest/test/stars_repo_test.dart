import 'package:checks/checks.dart';
import 'package:stars_digest/src/io/stars_repo.dart';
import 'package:test/test.dart';

class _Fake implements StarsRepo {
  @override
  String headSha() => 'HEAD';
  @override
  String readLlmsTxt() => 'new';
  @override
  String readLlmsFull() => 'full';
  @override
  String? showLlmsTxtAt(String sha) => sha == 'old' ? 'baseline' : null;
}

void main() {
  test('StarsRepo exposes head, current files, and historical llms.txt', () {
    final StarsRepo repo = _Fake();
    check(repo.headSha()).equals('HEAD');
    check(repo.readLlmsTxt()).equals('new');
    check(repo.readLlmsFull()).equals('full');
    check(repo.showLlmsTxtAt('old')).equals('baseline');
    check(repo.showLlmsTxtAt('missing')).isNull();
  });
}
