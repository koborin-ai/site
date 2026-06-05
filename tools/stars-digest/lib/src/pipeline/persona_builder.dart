import '../domain/models.dart';

final _frontmatterRe = RegExp(r'^---\n.*?\n---\n', dotAll: true);
final _importRe = RegExp(r'^\s*import\s.*$', multiLine: true);
final _selfClosingTagRe = RegExp(r'<[A-Za-z][^>]*/>');
final _tagRe = RegExp(r'</?[A-Za-z][^>]*>');

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
    stack: stripMdx(indexMdx),
    character: character,
    steering: steering.trim(),
  );
}
