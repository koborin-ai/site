// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'flow_input.dart';

// **************************************************************************
// SchemaGenerator
// **************************************************************************

/// Per-run input for the `starsDigest` flow (the Dev UI's Input JSON).
base class DigestFlowInput {
  /// Creates a [DigestFlowInput] from a JSON map.
  factory DigestFlowInput.fromJson(Map<String, dynamic> json) =>
      $schema.parse(json);

  DigestFlowInput._(this._json);

  DigestFlowInput({String? dateJst, bool? dryRun, int? maxSubs}) {
    _json = {'dateJst': ?dateJst, 'dryRun': ?dryRun, 'maxSubs': ?maxSubs};
  }

  late final Map<String, dynamic> _json;

  /// The JSON schema and type descriptor for [DigestFlowInput].
  static const SchemanticType<DigestFlowInput> $schema =
      _DigestFlowInputTypeFactory();

  /// JST date (YYYY-MM-DD). Empty/omitted = today.
  String? get dateJst {
    return _json['dateJst'] as String?;
  }

  /// JST date (YYYY-MM-DD). Empty/omitted = today.
  set dateJst(String? value) {
    if (value == null) {
      _json.remove('dateJst');
    } else {
      _json['dateJst'] = value;
    }
  }

  /// When true, use the offline stub model instead of Gemini.
  bool? get dryRun {
    return _json['dryRun'] as bool?;
  }

  /// When true, use the offline stub model instead of Gemini.
  set dryRun(bool? value) {
    if (value == null) {
      _json.remove('dryRun');
    } else {
      _json['dryRun'] = value;
    }
  }

  /// Max number of new-arrival sub items (default 5 when null).
  int? get maxSubs {
    return _json['maxSubs'] as int?;
  }

  /// Max number of new-arrival sub items (default 5 when null).
  set maxSubs(int? value) {
    if (value == null) {
      _json.remove('maxSubs');
    } else {
      _json['maxSubs'] = value;
    }
  }

  @override
  String toString() {
    return _json.toString();
  }

  /// Serializes this [DigestFlowInput] to a JSON map.
  Map<String, dynamic> toJson() {
    return _json;
  }
}

base class _DigestFlowInputTypeFactory extends SchemanticType<DigestFlowInput> {
  const _DigestFlowInputTypeFactory();

  @override
  DigestFlowInput parse(Object? json) {
    return DigestFlowInput._(json as Map<String, dynamic>);
  }

  @override
  JsonSchemaMetadata get schemaMetadata => JsonSchemaMetadata(
    name: 'DigestFlowInput',
    definition: $Schema
        .object(
          properties: {
            'dateJst': $Schema.string(),
            'dryRun': $Schema.boolean(),
            'maxSubs': $Schema.integer(),
          },
        )
        .value,
    dependencies: [],
  );
}
