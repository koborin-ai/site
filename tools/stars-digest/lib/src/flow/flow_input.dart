import 'package:schemantic/schemantic.dart';

part 'flow_input.g.dart';

/// Per-run input for the `starsDigest` flow (the Dev UI's Input JSON).
@Schema()
abstract class $DigestFlowInput {
  /// JST date (YYYY-MM-DD). Empty/omitted = today.
  String? get dateJst;

  /// When true, use the offline stub model instead of Gemini.
  bool? get dryRun;

  /// Max number of new-arrival sub items (default 5 when null).
  int? get maxSubs;
}
