final _itemRe = RegExp(r'^- \[([^\]]+)\]\(');

Set<String> _ids(String llmsTxt) {
  final ids = <String>{};
  for (final line in llmsTxt.split('\n')) {
    final m = _itemRe.firstMatch(line.trimRight());
    if (m != null) ids.add(m.group(1)!);
  }
  return ids;
}

/// Repo ids present in [newLlmsTxt] but not in [oldLlmsTxt].
/// Empty [oldLlmsTxt] (no baseline / first run) yields an empty set.
Set<String> detectNewArrivals({
  required String oldLlmsTxt,
  required String newLlmsTxt,
}) {
  final old = _ids(oldLlmsTxt);
  if (old.isEmpty) return <String>{};
  return _ids(newLlmsTxt).difference(old);
}
