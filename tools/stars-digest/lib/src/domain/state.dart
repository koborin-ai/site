/// Persisted generator state (committed as state/featured.json).
class DigestState {
  final Set<String> mainFeatured;
  final String? lastProcessedStarsSha;

  const DigestState({this.mainFeatured = const {}, this.lastProcessedStarsSha});

  factory DigestState.fromJson(Map<String, dynamic> json) => DigestState(
    mainFeatured: ((json['mainFeatured'] as List?) ?? const [])
        .map((e) => e as String)
        .toSet(),
    lastProcessedStarsSha: json['lastProcessedStarsSha'] as String?,
  );

  Map<String, dynamic> toJson() => {
    'mainFeatured': (mainFeatured.toList()..sort()),
    if (lastProcessedStarsSha != null)
      'lastProcessedStarsSha': lastProcessedStarsSha,
  };

  /// Returns a new [DigestState] with [id] added to [mainFeatured]
  /// and [lastProcessedStarsSha] updated to [sha].
  DigestState withMainFeatured(String id, {required String sha}) => DigestState(
    mainFeatured: {...mainFeatured, id},
    lastProcessedStarsSha: sha,
  );
}
