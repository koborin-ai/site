import '../domain/edition.dart';
import '../domain/models.dart';

const _footer =
    'この号は **starmap × Genkit (Dart) + Gemini** により自動生成された個人用ニュースレターです。'
    '所感・活用案は AI 生成であり、私の見解と完全一致するとは限りません。';

String _stars(RepoRef r) => switch (r.stars) {
  final s? => ' · ⭐$s',
  _ => '',
};
String _lang(RepoRef r) => switch (r.language) {
  final l? => ' · $l',
  _ => '',
};

/// Renders one edition page (frontmatter + body) from a [DigestResult].
String renderEdition(DigestResult result) {
  final e = result.edition;
  final main = result.main;
  final b = StringBuffer()
    ..writeln('---')
    ..writeln('title: ${_yamlString(e.title)}')
    ..writeln('description: ${_yamlString(_truncate(e.intro, 140))}')
    ..writeln('publishedAt: ${result.dateJst}')
    ..writeln('draft: false')
    ..writeln('lastUpdated: false')
    ..writeln('---')
    ..writeln()
    ..writeln(e.intro)
    ..writeln()
    ..writeln('## 🔍 今日の発掘: [${main.id}](${main.url})')
    ..writeln('${main.category}${_lang(main)}${_stars(main)}')
    ..writeln()
    ..writeln('> ${e.main.hook}')
    ..writeln()
    ..writeln('### これは何か')
    ..writeln(e.main.whatItIs)
    ..writeln()
    ..writeln('### なぜ私に刺さるか')
    ..writeln(e.main.whyItResonates)
    ..writeln()
    ..writeln('### 活用ユースケース');
  for (final u in e.main.useCases) {
    b.writeln('- $u');
  }
  b
    ..writeln()
    ..writeln('### 最初の一歩')
    ..writeln(e.main.firstStep);

  if (result.subs.isNotEmpty) {
    b
      ..writeln()
      ..writeln('## 🆕 新着 Star');
    final n = result.subs.length < e.subs.length
        ? result.subs.length
        : e.subs.length;
    for (var i = 0; i < n; i++) {
      final repo = result.subs[i];
      final sub = e.subs[i];
      b
        ..writeln()
        ..writeln('### [${repo.id}](${repo.url})')
        ..writeln('${repo.category}${_lang(repo)}${_stars(repo)}')
        ..writeln()
        ..writeln('${sub.oneLine} — ${sub.hook}');
    }
  }

  if (result.overflow.isNotEmpty) {
    b
      ..writeln()
      ..writeln('### ほか ${result.overflow.length} 件');
    for (final repo in result.overflow) {
      b.writeln('- [${repo.id}](${repo.url})');
    }
  }

  b
    ..writeln()
    ..writeln('---')
    ..writeln()
    ..writeln(_footer);
  return b.toString();
}

/// Renders the `/stars` index page from edition metadata (newest first).
String renderIndex({required List<EditionMeta> editions}) {
  final sorted = [...editions]..sort((a, b) => b.dateJst.compareTo(a.dateJst));
  final b = StringBuffer()
    ..writeln('---')
    ..writeln('title: Stars')
    ..writeln('description: Star した OSS の毎日のパーソナル・ニュースレター')
    ..writeln('lastUpdated: false')
    ..writeln('---')
    ..writeln()
    ..writeln('Star した OSS を、私のスタックと関心を踏まえて毎日1号お届けする個人用ニュースレターです。')
    ..writeln(_footer)
    ..writeln()
    ..writeln('## Editions')
    ..writeln();
  for (final e in sorted) {
    b.writeln(
      '- [${e.dateJst} — ${e.title}](/stars/${e.dateJst}/) — ${e.description}',
    );
  }
  return b.toString();
}

/// Index metadata for a freshly generated edition.
EditionMeta editionMetaFrom(DigestResult result) => EditionMeta(
  dateJst: result.dateJst,
  title: result.edition.title,
  description: _truncate(result.edition.intro, 140),
);

String _truncate(String s, int n) {
  final t = s.replaceAll(RegExp(r'\s+'), ' ').trim();
  return t.length <= n ? t : '${t.substring(0, n)}…';
}

String _yamlString(String s) {
  final oneLine = s.replaceAll(RegExp(r'\s+'), ' ').trim();
  final escaped = oneLine.replaceAll('\\', r'\\').replaceAll('"', r'\"');
  return '"$escaped"';
}
