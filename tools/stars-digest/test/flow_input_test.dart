import 'package:checks/checks.dart';
import 'package:stars_digest/stars_digest.dart';
import 'package:test/test.dart';

void main() {
  test('DigestFlowInput round-trips and tolerates empty json', () {
    final a = DigestFlowInput(dateJst: '2026-05-31', dryRun: true, maxSubs: 3);
    final parsed = DigestFlowInput.fromJson(a.toJson());
    check(parsed.dateJst).equals('2026-05-31');
    check(parsed.dryRun).equals(true);
    check(parsed.maxSubs).equals(3);

    final empty = DigestFlowInput.fromJson(const {});
    check(empty.dateJst).isNull();
    check(empty.dryRun).isNull();
    check(empty.maxSubs).isNull();
  });
}
