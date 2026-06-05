import 'package:checks/checks.dart';
import 'package:stars_digest/src/domain/models.dart';
import 'package:test/test.dart';

void main() {
  test('Persona.toContext concatenates sections with labels', () {
    const p = Persona(
      stack: 'Dart/Flutter, Genkit',
      character: '全てに意味がある',
      steering: '簡潔に',
    );
    final ctx = p.toContext();
    check(ctx).contains('Dart/Flutter, Genkit');
    check(ctx).contains('全てに意味がある');
    check(ctx).contains('簡潔に');
  });

  test('Repo keeps id and optional fields', () {
    const r = Repo(
      id: 'a/b',
      url: 'https://x',
      category: '🤖 AI Frameworks',
      description: 'd',
    );
    check(r.id).equals('a/b');
    check(r.stars).isNull();
  });
}
