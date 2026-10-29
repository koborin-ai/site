import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:crypto/crypto.dart';

final class StateIdentity {
  const StateIdentity({required this.lineage, required this.serial});

  final String lineage;
  final int serial;
}

final class StateFile {
  StateFile._(this.bytes, this.identity);

  factory StateFile.parse(List<int> bytes) {
    final Object? json;
    try {
      json = jsonDecode(utf8.decode(bytes));
    } on FormatException {
      throw const FormatException('state is not UTF-8 JSON');
    }
    if (json case {
      'lineage': final String lineage,
      'serial': final int serial,
    } when lineage.isNotEmpty && serial >= 0) {
      return StateFile._(
        List.unmodifiable(bytes),
        StateIdentity(lineage: lineage, serial: serial),
      );
    }
    throw const FormatException(
      'state has no non-empty lineage and non-negative integer serial',
    );
  }

  final List<int> bytes;
  final StateIdentity identity;
}

abstract interface class StateReader {
  Future<List<int>?> read();
}

abstract interface class StateStore implements StateReader {
  Future<bool> createIfAbsent(List<int> bytes);
}

sealed class Adoption {
  const Adoption({required this.source, required this.target});

  final StateIdentity source;
  final StateIdentity target;
}

final class Copied extends Adoption {
  const Copied({required super.source, required super.target});
}

final class AlreadyAdopted extends Adoption {
  const AlreadyAdopted({required super.source, required super.target});
}

enum Refusal {
  sourceMissing,
  sourceUnreadable,
  targetUnreadable,
  foreignLineage,
  behindSource,
  copyMismatch,
  bucketDrift,
  unexpectedBackend,
  targetMissing,
}

final class StateRefused implements Exception {
  const StateRefused(this.reason, this.detail);

  final Refusal reason;
  final String detail;

  @override
  String toString() => 'StateRefused(${reason.name}): $detail';
}

Future<Adoption> adopt({
  required StateReader from,
  required StateStore to,
}) async {
  final source = await _readSource(from);
  final existing = await to.read();
  if (existing != null) return _judge(source, existing);

  final created = await to.createIfAbsent(source.bytes);
  final readBack = await to.read();
  if (!created) return _judge(source, readBack);
  if (readBack == null || !_sameBytes(readBack, source.bytes)) {
    throw const StateRefused(
      Refusal.copyMismatch,
      'the created target does not read back the source bytes',
    );
  }
  return Copied(source: source.identity, target: source.identity);
}

Future<AlreadyAdopted> requireAdopted({
  required StateReader from,
  required StateReader target,
}) async {
  final source = await _readSource(from);
  return _judge(source, await target.read());
}

Future<StateFile> _readSource(StateReader from) async {
  final bytes = await from.read();
  if (bytes == null) {
    throw const StateRefused(Refusal.sourceMissing, 'the source is absent');
  }
  try {
    return StateFile.parse(bytes);
  } on FormatException catch (e) {
    throw StateRefused(Refusal.sourceUnreadable, 'source: ${e.message}');
  }
}

/// OpenTofu bumps serial whenever it writes, so an equal serial must still be
/// the copied bytes, and a greater serial is legitimately different.
AlreadyAdopted _judge(StateFile source, List<int>? bytes) {
  if (bytes == null) {
    throw const StateRefused(Refusal.targetMissing, 'the target is absent');
  }
  final StateFile target;
  try {
    target = StateFile.parse(bytes);
  } on FormatException catch (e) {
    throw StateRefused(Refusal.targetUnreadable, 'target: ${e.message}');
  }
  final (want, have) = (source.identity, target.identity);
  if (have.lineage != want.lineage) {
    throw StateRefused(
      Refusal.foreignLineage,
      'target lineage ${have.lineage} is not source lineage ${want.lineage}',
    );
  }
  if (have.serial < want.serial) {
    throw StateRefused(
      Refusal.behindSource,
      'target serial ${have.serial} is behind source serial ${want.serial} '
      'on lineage ${want.lineage}',
    );
  }
  if (have.serial == want.serial && !_sameBytes(bytes, source.bytes)) {
    throw StateRefused(
      Refusal.copyMismatch,
      'target serial ${have.serial} matches the source but its bytes differ',
    );
  }
  return AlreadyAdopted(source: want, target: have);
}

bool _sameBytes(List<int> a, List<int> b) {
  if (a.length != b.length) return false;
  for (var i = 0; i < a.length; i++) {
    if (a[i] != b[i]) return false;
  }
  return true;
}

final class StateLocation {
  const StateLocation._({required this.bucket, required this.name});

  final String bucket;
  final String name;

  String get uri => 'gs://$bucket/$name';
}

final _objectPrefix = RegExp(r'^[^/]+(/[^/]+)*$');

Future<StateLocation> synthesizedStateObject({
  required String expectedBucket,
  String? accountId,
}) async {
  final account = accountId ?? Platform.environment['CLOUDFLARE_ACCOUNT_ID'];
  if (account == null || account.isEmpty) {
    throw const StateRefused(
      Refusal.unexpectedBackend,
      'CLOUDFLARE_ACCOUNT_ID is missing',
    );
  }
  final temp = await Directory.systemTemp.createTemp('state-adopt');
  try {
    final manifest = File('${temp.path}/manifest.json');
    const args = ['run', 'bin/infra.dart'];
    final run = await Process.run(
      Platform.resolvedExecutable,
      args,
      environment: {
        'TERRADART_MANIFEST': manifest.path,
        'CLOUDFLARE_ACCOUNT_ID': account,
      },
      includeParentEnvironment: false,
    );
    if (run.exitCode != 0) {
      throw ProcessException(
        Platform.resolvedExecutable,
        args,
        '${run.stderr}',
        run.exitCode,
      );
    }

    final dir = switch (await manifest.exists()
        ? jsonDecode(await manifest.readAsString())
        : null) {
      {
        'version': 1,
        'roots': [
          {'dir': final String dir, 'workspace': null, 'backend_config': []},
        ],
      } =>
        dir,
      _ => throw const StateRefused(
        Refusal.unexpectedBackend,
        'the manifest is not one root without a workspace or backend_config',
      ),
    };

    final tf = jsonDecode(await File('$dir/main.tf.json').readAsString());
    final (bucket, prefix) = switch (tf) {
      {
        'terraform': {
          'backend':
              {
                'gcs':
                    {
                      'bucket': final String bucket,
                      'prefix': final String prefix,
                    } &&
                    Map<String, Object?>(length: 2),
              } &&
              Map<String, Object?>(length: 1),
        },
      }
          when _objectPrefix.hasMatch(prefix) =>
        (bucket, prefix),
      _ => throw const StateRefused(
        Refusal.unexpectedBackend,
        'terraform.backend is not exactly gcs with a bucket and a prefix',
      ),
    };

    if (bucket != expectedBucket) {
      throw StateRefused(
        Refusal.bucketDrift,
        'expected bucket $expectedBucket, but bin/infra.dart keeps state in '
        '$bucket',
      );
    }
    // OpenTofu's gcs backend stores workspace W at <prefix>/W.tfstate.
    return StateLocation._(bucket: bucket, name: '$prefix/default.tfstate');
  } finally {
    await temp.delete(recursive: true);
  }
}

final class SigV4 {
  const SigV4({
    required this.accessKeyId,
    required this.secretAccessKey,
    required this.region,
    required this.service,
  });

  final String accessKeyId;
  final String secretAccessKey;
  final String region;
  final String service;

  Map<String, String> sign(
    String method,
    Uri url,
    DateTime time, {
    Map<String, String> headers = const {},
  }) {
    if (url.hasQuery) throw ArgumentError.value(url, 'url', 'has a query');
    final stamp = time.toUtc().toIso8601String().replaceAll(
      RegExp(r'[-:]|\.\d+'),
      '',
    );
    final date = stamp.substring(0, 8);
    final payloadHash = sha256.convert(const <int>[]).toString();
    final signed = {
      for (final MapEntry(:key, :value) in headers.entries)
        key.toLowerCase(): value.trim(),
      'host': url.host,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': stamp,
    };
    final names = signed.keys.toList()..sort();
    final signedHeaders = names.join(';');
    final canonicalRequest = [
      method,
      url.path,
      '',
      for (final name in names) '$name:${signed[name]}',
      '',
      signedHeaders,
      payloadHash,
    ].join('\n');
    final scope = '$date/$region/$service/aws4_request';
    final stringToSign = [
      'AWS4-HMAC-SHA256',
      stamp,
      scope,
      sha256.convert(utf8.encode(canonicalRequest)).toString(),
    ].join('\n');
    var key = utf8.encode('AWS4$secretAccessKey');
    for (final part in [date, region, service, 'aws4_request']) {
      key = Uint8List.fromList(_hmac(key, part));
    }
    final signature = Hmac(sha256, key).convert(utf8.encode(stringToSign));
    return {
      for (final name in names)
        if (name != 'host') name: signed[name]!,
      'authorization':
          'AWS4-HMAC-SHA256 Credential=$accessKeyId/$scope,'
          'SignedHeaders=$signedHeaders,Signature=$signature',
    };
  }
}

List<int> _hmac(List<int> key, String message) =>
    Hmac(sha256, key).convert(utf8.encode(message)).bytes;

final class R2Object implements StateReader {
  R2Object._(this._url, this._signer);

  factory R2Object.siteState({
    required String accountId,
    required String accessKeyId,
    required String secretAccessKey,
  }) {
    if (!RegExp(r'^[0-9a-fA-F]{32}$').hasMatch(accountId)) {
      throw ArgumentError('the Cloudflare account id is not 32 hex digits');
    }
    return R2Object._(
      Uri.https(
        '$accountId.r2.cloudflarestorage.com',
        '/koborin-ai-tfstate/terraform/site/terraform.tfstate',
      ),
      SigV4(
        accessKeyId: accessKeyId,
        secretAccessKey: secretAccessKey,
        region: 'auto',
        service: 's3',
      ),
    );
  }

  final Uri _url;
  final SigV4 _signer;

  @override
  Future<List<int>?> read() async {
    final (status, body) = await _send(
      'GET',
      _url,
      _signer.sign('GET', _url, DateTime.now()),
    );
    return switch (status) {
      200 => body,
      404 => null,
      _ => throw HttpException('GET answered $status', uri: _url),
    };
  }
}

final class GcsObject implements StateReader {
  GcsObject(this.location, {required String accessToken})
    : _accessToken = accessToken;

  final StateLocation location;
  final String _accessToken;

  @override
  Future<List<int>?> read() async {
    final url = Uri(
      scheme: 'https',
      host: 'storage.googleapis.com',
      pathSegments: ['storage', 'v1', 'b', location.bucket, 'o', location.name],
      queryParameters: {'alt': 'media'},
    );
    final (status, body) = await _send('GET', url, {
      'authorization': 'Bearer $_accessToken',
    });
    return switch (status) {
      200 => body,
      404 => null,
      _ => throw HttpException('GET answered $status', uri: url),
    };
  }
}

/// [GcsObject] plus a create that the generation-0 precondition keeps from
/// ever replacing an object.
final class CreatableGcsObject extends GcsObject implements StateStore {
  CreatableGcsObject(super.location, {required super.accessToken});

  @override
  Future<bool> createIfAbsent(List<int> bytes) async {
    final url = Uri(
      scheme: 'https',
      host: 'storage.googleapis.com',
      pathSegments: ['upload', 'storage', 'v1', 'b', location.bucket, 'o'],
      queryParameters: {
        'uploadType': 'media',
        'name': location.name,
        'ifGenerationMatch': '0',
      },
    );
    final (status, _) = await _send('POST', url, {
      'authorization': 'Bearer $_accessToken',
      'content-type': 'application/json',
    }, bytes);
    return switch (status) {
      200 => true,
      412 => false,
      _ => throw HttpException('POST answered $status', uri: url),
    };
  }
}

Future<(int, List<int>)> _send(
  String method,
  Uri url,
  Map<String, String> headers, [
  List<int>? body,
]) async {
  final client = HttpClient();
  try {
    final request = await client.openUrl(method, url);
    headers.forEach(request.headers.set);
    if (body != null) {
      request.contentLength = body.length;
      request.add(body);
    }
    final response = await request.close();
    final received = BytesBuilder(copy: false);
    await response.forEach(received.add);
    return (response.statusCode, received.takeBytes());
  } finally {
    client.close();
  }
}

const _exitUsage = 64;
const _exitRefused = 1;

const _requiredEnvironment = [
  'CLOUDFLARE_ACCOUNT_ID',
  'TFSTATE_BUCKET',
  'GCS_ACCESS_TOKEN',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
];

Future<void> runStateCommand(
  Future<Adoption> Function(
    StateReader source,
    StateLocation target,
    String accessToken,
  )
  decide,
) async {
  final env = Platform.environment;
  final missing = [
    for (final name in _requiredEnvironment)
      if (env[name]?.isNotEmpty != true) name,
  ];
  if (missing.isNotEmpty) {
    stderr.writeln('missing or empty: ${missing.join(', ')}');
    exitCode = _exitUsage;
    return;
  }

  StateLocation? location;
  try {
    final r2 = R2Object.siteState(
      accountId: env['CLOUDFLARE_ACCOUNT_ID']!,
      accessKeyId: env['R2_ACCESS_KEY_ID']!,
      secretAccessKey: env['R2_SECRET_ACCESS_KEY']!,
    );
    location = await synthesizedStateObject(
      expectedBucket: env['TFSTATE_BUCKET']!,
    );
    final adoption = await decide(r2, location, env['GCS_ACCESS_TOKEN']!);
    stdout.writeln(
      jsonEncode({
        'event': 'tfstate-adopt',
        'target': location.uri,
        ...switch (adoption) {
          Copied(:final target) => {
            'outcome': 'copied',
            'lineage': target.lineage,
            'serial': target.serial,
          },
          AlreadyAdopted(:final source, :final target) => {
            'outcome': 'already-adopted',
            'lineage': target.lineage,
            'sourceSerial': source.serial,
            'targetSerial': target.serial,
          },
        },
      }),
    );
  } on StateRefused catch (refused) {
    stdout.writeln(
      jsonEncode({
        'event': 'tfstate-adopt',
        'target': ?location?.uri,
        'outcome': 'refused',
        'reason': refused.reason.name,
        'detail': refused.detail,
      }),
    );
    exitCode = _exitRefused;
  }
}
