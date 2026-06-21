/// A starred repository parsed from the stars repo exports.
class Repo {
  final String id; // "owner/name"
  final String url;
  final String category;
  final String description;
  final String? language;
  final int? stars;
  final String? readme;

  const Repo({
    required this.id,
    required this.url,
    required this.category,
    required this.description,
    this.language,
    this.stars,
    this.readme,
  });

  Repo copyWith({String? language, int? stars, String? readme}) => Repo(
    id: id,
    url: url,
    category: category,
    description: description,
    language: language ?? this.language,
    stars: stars ?? this.stars,
    readme: readme ?? this.readme,
  );
}

/// The author's persona assembled from site content.
class Persona {
  final String stack;
  final String character;
  final String steering;

  const Persona({
    required this.stack,
    required this.character,
    required this.steering,
  });

  String toContext() {
    final b = StringBuffer()
      ..writeln('## 技術スタック・案件経験')
      ..writeln(stack)
      ..writeln()
      ..writeln('## 人柄・価値観・語り口')
      ..writeln(character);
    if (steering.trim().isNotEmpty) {
      b
        ..writeln()
        ..writeln('## 追加の編集方針')
        ..writeln(steering.trim());
    }
    return b.toString();
  }
}

/// The chosen repos for one edition.
class Selection {
  final Repo main; // backlog rediscovery pick
  final List<Repo> subs; // new arrivals (up to maxSubs)
  final List<Repo> overflow; // new arrivals beyond maxSubs

  const Selection({
    required this.main,
    required this.subs,
    required this.overflow,
  });
}

/// Lightweight metadata for the index listing.
class EditionMeta {
  final String dateJst;
  final String title;
  final String description;

  const EditionMeta({
    required this.dateJst,
    required this.title,
    required this.description,
  });
}
