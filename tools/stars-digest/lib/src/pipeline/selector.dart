import '../domain/models.dart';

/// Deterministic FNV-1a 32-bit hash (stable across runs, unlike hashCode).
int _stableHash(String s) {
  var h = 0x811c9dc5;
  for (final c in s.codeUnits) {
    h ^= c;
    h = (h * 0x01000193) & 0xFFFFFFFF;
  }
  return h;
}

/// Selects one edition: main = a deterministic backlog rediscovery pick
/// (excluding featured repos and new arrivals); subs = new arrivals
/// (capped at [maxSubs], the remainder placed in overflow).
Selection selectEdition({
  required List<Repo> repos,
  required Set<String> newArrivalIds,
  required Set<String> featuredIds,
  required String dateSeed,
  int maxSubs = 5,
}) {
  final byId = {for (final r in repos) r.id: r};

  final newArrivals =
      newArrivalIds.where(byId.containsKey).map((id) => byId[id]!).toList()
        ..sort((a, b) => a.id.compareTo(b.id));
  final subs = newArrivals.take(maxSubs).toList();
  final overflow = newArrivals.skip(maxSubs).toList();

  final excluded = {...featuredIds, ...newArrivalIds};
  var candidates = repos.where((r) => !excluded.contains(r.id)).toList();
  if (candidates.isEmpty) {
    // Backlog exhausted: re-select excluding only new arrivals (keep featured).
    candidates = repos.where((r) => !newArrivalIds.contains(r.id)).toList();
  }
  if (candidates.isEmpty) candidates = repos;

  candidates.sort(
    (a, b) => _stableHash(
      '$dateSeed/${a.id}',
    ).compareTo(_stableHash('$dateSeed/${b.id}')),
  );
  final main = candidates.first;

  return Selection(main: main, subs: subs, overflow: overflow);
}
