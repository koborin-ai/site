import '../domain/models.dart';

/// Parses the stars repo exports (`llms.txt` + `llms-full.md`) into [Repo]s.
class StarsSource {
  static final _headingRe = RegExp(r'^##\s+(.*)$');
  static final _itemRe = RegExp(r'^- \[([^\]]+)\]\(([^)]+)\)(?::\s*(.*))?$');
  static final _fullHeadingRe = RegExp(r'^###\s+\[([^\]]+)\]\(([^)]+)\)');
  static final _langRe = RegExp(r'^- \*\*Language:\*\*\s*(.*)$');
  static final _starsRe = RegExp(r'^- \*\*Stars:\*\*\s*([0-9]+)');

  static List<Repo> parse({required String llmsTxt, required String llmsFull}) {
    final repos = _parseLlmsTxt(llmsTxt);
    return _enrich(repos, llmsFull);
  }

  static Map<String, Repo> _parseLlmsTxt(String txt) {
    final out = <String, Repo>{};
    var category = 'その他';
    for (final line in txt.split('\n')) {
      final h = _headingRe.firstMatch(line);
      if (h != null) {
        category = h.group(1)!.trim();
        continue;
      }
      final m = _itemRe.firstMatch(line.trimRight());
      if (m == null) continue;
      final id = m.group(1)!;
      final repo = Repo(
        id: id,
        url: m.group(2)!,
        category: category,
        description: (m.group(3) ?? '').trim(),
      );
      final existing = out[id];
      if (existing == null || _isFocus(existing.category)) {
        out[id] = repo;
      }
    }
    return out;
  }

  static bool _isFocus(String category) => category.contains('Focus');

  static List<Repo> _enrich(Map<String, Repo> repos, String full) {
    String? currentId;
    final lang = <String, String>{};
    final stars = <String, int>{};
    final readme = <String, StringBuffer>{};
    var inReadme = false;

    for (final line in full.split('\n')) {
      final h = _fullHeadingRe.firstMatch(line);
      if (h != null) {
        currentId = h.group(1);
        inReadme = false;
        continue;
      }
      if (currentId == null) continue;
      if (line.contains('<summary>README</summary>')) {
        inReadme = true;
        readme[currentId] = StringBuffer();
        continue;
      }
      if (line.contains('</details>')) {
        inReadme = false;
        continue;
      }
      if (inReadme) {
        readme[currentId]!.writeln(line);
        continue;
      }
      final lm = _langRe.firstMatch(line);
      if (lm != null) lang[currentId] = lm.group(1)!.trim();
      final sm = _starsRe.firstMatch(line);
      if (sm != null) stars[currentId] = int.parse(sm.group(1)!);
    }

    return repos.values
        .map(
          (r) => r.copyWith(
            language: lang[r.id],
            stars: stars[r.id],
            readme: readme[r.id]?.toString().trim(),
          ),
        )
        .toList();
  }
}
