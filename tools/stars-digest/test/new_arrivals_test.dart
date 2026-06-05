import 'dart:io';
import 'package:checks/checks.dart';
import 'package:stars_digest/src/pipeline/new_arrivals.dart';
import 'package:test/test.dart';

void main() {
  test('returns ids present in new but not old', () {
    final oldTxt = File('test/fixtures/llms_old.txt').readAsStringSync();
    final newTxt = File('test/fixtures/llms_new.txt').readAsStringSync();
    final added = detectNewArrivals(oldLlmsTxt: oldTxt, newLlmsTxt: newTxt);
    check(added).contains('nozomi-koborinai/starmap');
    check(added).not((it) => it.contains('nozomi-koborinai/contextlint'));
    check(added).not((it) => it.contains('nozomi-koborinai/n-koborinai-me'));
  });

  test('empty old means no baseline → no new arrivals', () {
    final newTxt = File('test/fixtures/llms_new.txt').readAsStringSync();
    check(detectNewArrivals(oldLlmsTxt: '', newLlmsTxt: newTxt)).isEmpty();
  });
}
