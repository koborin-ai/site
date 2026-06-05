import 'package:checks/checks.dart';
import 'package:stars_digest/stars_digest.dart';
import 'package:test/test.dart';

void main() {
  test('returns GOOGLE_CLOUD_PROJECT when set', () {
    check(
      requireVertexProject({'GOOGLE_CLOUD_PROJECT': 'my-proj'}),
    ).equals('my-proj');
  });

  test('throws StateError when unset or empty', () {
    check(() => requireVertexProject(const {})).throws<StateError>();
    check(
      () => requireVertexProject({'GOOGLE_CLOUD_PROJECT': ''}),
    ).throws<StateError>();
  });
}
