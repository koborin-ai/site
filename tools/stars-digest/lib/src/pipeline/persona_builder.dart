import '../domain/models.dart';

final _frontmatterRe = RegExp(r'^---\n.*?\n---\n', dotAll: true);
final _importRe = RegExp(r'^\s*import\s.*$', multiLine: true);
final _selfClosingTagRe = RegExp(r'<[A-Za-z][^>]*/>');
final _tagRe = RegExp(r'</?[A-Za-z][^>]*>');
final _h2Re = RegExp(r'^## (?!#)(.+)$');

/// Strips MDX noise (frontmatter, import lines, JSX tags) leaving prose.
String stripMdx(String mdx) {
  var s = mdx.replaceFirst(_frontmatterRe, '');
  s = s.replaceAll(_importRe, '');
  s = s.replaceAll(_selfClosingTagRe, '');
  s = s.replaceAll(_tagRe, '');
  // Collapse 3+ consecutive newlines into a blank line.
  s = s.replaceAll(RegExp(r'\n{3,}'), '\n\n');
  return s.trim();
}

/// Splits MDX prose into level-2 (`##`) sections keyed by heading text.
Map<String, String> extractSections(String mdx) {
  final text = stripMdx(mdx);
  final sections = <String, String>{};
  String? currentTitle;
  final buffer = StringBuffer();

  void flush() {
    final title = currentTitle;
    if (title == null) return;
    sections[title] = buffer.toString().trim();
    buffer.clear();
  }

  for (final line in text.split('\n')) {
    final match = _h2Re.firstMatch(line);
    if (match != null) {
      flush();
      currentTitle = match.group(1)!.trim();
      continue;
    }
    if (currentTitle != null) {
      buffer.writeln(line);
    }
  }
  flush();
  return sections;
}

String? _section(Map<String, String> sections, String title) {
  final value = sections[title];
  if (value == null || value.trim().isEmpty) return null;
  return value.trim();
}

void _appendSection(StringBuffer b, String title, String body) {
  b
    ..writeln('### $title')
    ..writeln(body)
    ..writeln();
}

/// Builds a stack profile that foregrounds deliverable project experience over
/// personal AI-side explorations.
String buildStackProfile(String indexMdx) {
  final sections = extractSections(indexMdx);
  final b = StringBuffer()
    ..writeln(
      'ニュースレターでは、以下の順で接点を探す。'
      '特に「案件で扱ってきた技術スタック・ドメイン」を最優先する。',
    )
    ..writeln();

  final whoRunsThis = _section(sections, 'Who runs this');
  if (whoRunsThis != null) {
    _appendSection(b, '肩書・専門領域', whoRunsThis);
  }

  final projects = _section(sections, 'プロジェクト実績');
  if (projects != null) {
    _appendSection(b, '案件で扱ってきた技術スタック・ドメイン', projects);
  }

  final career = _section(sections, '経歴');
  if (career != null) {
    _appendSection(b, '経歴', career);
  }

  final oss = _section(sections, 'OSS Contributions');
  if (oss != null) {
    _appendSection(b, 'OSS・コミュニティ', oss);
  }

  final highlights = _section(sections, 'ハイライト');
  if (highlights != null) {
    _appendSection(b, 'ハイライト', highlights);
  }

  final building = _section(sections, 'Building');
  if (building != null) {
    _appendSection(
      b,
      '個人で探求中のテーマ（補助的参考。案件スタックより優先度は低い）',
      building,
    );
  }

  final profile = b.toString().trim();
  if (profile.isNotEmpty) return profile;
  return stripMdx(indexMdx);
}

/// Builds the [Persona] from site content (stack from index, character from life).
Persona buildPersona({
  required String indexMdx,
  required List<String> lifeMdx,
  required String steering,
}) {
  final character = lifeMdx
      .map(stripMdx)
      .where((s) => s.isNotEmpty)
      .join('\n\n---\n\n');
  return Persona(
    stack: buildStackProfile(indexMdx),
    character: character,
    steering: steering.trim(),
  );
}
