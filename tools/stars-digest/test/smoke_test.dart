import 'package:checks/checks.dart';
import 'package:stars_digest/stars_digest.dart';
import 'package:test/test.dart';

void main() {
  // Verify the barrel exports the public API surface by referencing a known type.
  test('package loads', () {
    check(DigestState().mainFeatured).isEmpty();
  });
}
