import 'package:checks/checks.dart';
import 'package:genkit/genkit.dart';
import 'package:stars_digest/src/domain/models.dart';
import 'package:stars_digest/src/model/genkit_model.dart';
import 'package:test/test.dart';

/// Joins the text parts of every message with the given [role]. Rendered parts
/// come back as plain [Part] JSON wrappers rather than [TextPart] instances,
/// so the text is read off the JSON.
String _textOf(List<Message> messages, Role role) => messages
    .where((m) => m.role == role)
    .expand((m) => m.content)
    .map((p) => p.toJson()['text'] as String?)
    .whereType<String>()
    .join('\n');

void main() {
  const persona = Persona(
    stack: 'Genkit Dart, Google Cloud',
    character: '意味がある',
    steering: '簡潔に',
  );
  const mainRepo = Repo(
    id: 'main/repo',
    url: 'u',
    category: 'c',
    description: 'メイン説明',
    readme: 'README本文 <script> & "quoted"',
  );
  final sel = Selection(
    main: mainRepo,
    subs: const [
      Repo(id: 'sub/one', url: 'u2', category: 'c', description: 'サブ説明'),
    ],
    overflow: const [],
  );

  test('buildPromptInput carries the persona, the repos and the sub count', () {
    final input = buildPromptInput(
      persona: persona,
      selection: sel,
      dateJst: '2026-06-02',
    );
    check(input['dateJst']).equals('2026-06-02');
    check((input['persona']! as Map)['stack']).equals(
      'Genkit Dart, Google Cloud',
    );
    check((input['main']! as Map)['id']).equals('main/repo');
    check(input['subsCount']).equals(1);
    check(input['hasSubs']).equals(true);
  });

  test('buildPromptInput truncates and indents the readme excerpt', () {
    final long = Repo(
      id: 'long/repo',
      url: 'u',
      category: 'c',
      description: 'd',
      readme: 'x' * 2500,
    );
    final input = buildPromptInput(
      persona: persona,
      selection: Selection(main: long, subs: const [], overflow: const []),
      dateJst: '2026-06-02',
    );
    final excerpt = (input['main']! as Map)['readmeExcerpt'] as String;
    check(excerpt.length).equals(2000);
  });

  group('prompts/digest.prompt', () {
    late Genkit ai;

    setUp(() {
      ai = Genkit(plugins: [], promptDir: 'prompts');
    });

    tearDown(() async {
      await ai.shutdown();
    });

    Future<List<Message>> render(Selection selection) async {
      final prompt = await ai.prompt('digest');
      final rendered = await prompt.render(
        buildPromptInput(
          persona: persona,
          selection: selection,
          dateJst: '2026-06-02',
        ),
      );
      return rendered.messages;
    }

    test('puts the editorial instructions and the persona in system', () async {
      final system = _textOf(await render(sel), Role.system);
      check(system).contains('接点の優先順位');
      check(system).contains('案件・プロジェクト実績');
      check(system).contains('原則 **0 回**');
      check(system).contains('Genkit Dart, Google Cloud');
      check(system).contains('意味がある');
      check(system).contains('簡潔に');
    });

    test('puts the date, the main repo and the subs in user', () async {
      final user = _textOf(await render(sel), Role.user);
      check(user).contains('2026-06-02');
      check(user).contains('main/repo');
      check(user).contains('メイン説明');
      check(user).contains('sub/one');
      check(user).contains('1 本'); // subs count
    });

    test('does not HTML-escape repo prose', () async {
      final user = _textOf(await render(sel), Role.user);
      check(user).contains('<script>');
      check(user).contains('"quoted"');
      check(user).not((it) => it.contains('&lt;'));
      check(user).not((it) => it.contains('&quot;'));
    });

    test('renders (なし) when there are no new arrivals', () async {
      final user = _textOf(
        await render(
          Selection(main: mainRepo, subs: const [], overflow: const []),
        ),
        Role.user,
      );
      check(user).contains('0 本');
      check(user).contains('(なし)');
    });
  });
}
