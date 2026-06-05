import 'dart:io';

import 'package:checks/checks.dart';
import 'package:stars_digest/src/domain/models.dart';
import 'package:stars_digest/src/model/genkit_model.dart';
import 'package:test/test.dart';

void main() {
  const persona = Persona(
    stack: 'Genkit Dart, Google Cloud',
    character: '意味がある',
    steering: '簡潔に',
  );
  final sel = Selection(
    main: const Repo(
      id: 'main/repo',
      url: 'u',
      category: 'c',
      description: 'メイン説明',
      readme: 'README本文',
    ),
    subs: const [
      Repo(id: 'sub/one', url: 'u2', category: 'c', description: 'サブ説明'),
    ],
    overflow: const [],
  );

  test('buildSystemPrompt includes the instructions and the persona', () {
    final s = buildSystemPrompt(instructions: '編集者として書け。', persona: persona);
    check(s).contains('編集者として書け。');
    check(s).contains('Genkit Dart, Google Cloud');
    check(s).contains('意味がある');
    check(s).contains('簡潔に');
  });

  test('buildUserPrompt includes date, main and subs repo data', () {
    final u = buildUserPrompt(selection: sel, dateJst: '2026-06-02');
    check(u).contains('2026-06-02');
    check(u).contains('main/repo');
    check(u).contains('メイン説明');
    check(u).contains('sub/one');
    check(u).contains('1 本'); // subs count
  });

  test('real prompts/digest.md loads as system instructions', () {
    final instructions = File('prompts/digest.md').readAsStringSync();
    final s = buildSystemPrompt(instructions: instructions, persona: persona);
    check(s.trim()).isNotEmpty();
    check(s).contains('Genkit Dart, Google Cloud'); // persona appended
  });
}
