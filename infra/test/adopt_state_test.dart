import 'dart:convert';
import 'dart:io';

import 'package:test/test.dart';

import '../tool/state_adopt.dart';

List<int> state(String lineage, int serial, {String pad = ''}) => utf8.encode(
  '{"version":4,"lineage":"$lineage","serial":$serial,$pad"resources":[]}',
);

final class FakeReader implements StateReader {
  FakeReader(this.bytes);

  final List<int>? bytes;

  @override
  Future<List<int>?> read() async => bytes;
}

final class FakeStore implements StateStore {
  FakeStore(this.object, {this.racer, this.stores});

  List<int>? object;
  final List<int>? racer;
  final List<int>? stores;

  var creates = 0;
  var reads = 0;

  @override
  Future<List<int>?> read() async {
    reads++;
    return object;
  }

  @override
  Future<bool> createIfAbsent(List<int> bytes) async {
    creates++;
    object ??= racer;
    if (object != null) return false;
    object = stores ?? bytes;
    return true;
  }
}

Matcher outcome(Object expected) => expected is Refusal
    ? throwsA(isA<StateRefused>().having((e) => e.reason, 'reason', expected))
    : completion(
        isA<Adoption>().having((a) => a.runtimeType, 'type', expected),
      );

void main() {
  final l1At14 = state('L1', 14);

  final table = <(String, List<int>?, List<int>?, Object, Object)>[
    ('absent', null, l1At14, Copied, Refusal.targetMissing),
    ('L1 serial 14', l1At14, l1At14, AlreadyAdopted, AlreadyAdopted),
    ('L1 serial 17', state('L1', 17), l1At14, AlreadyAdopted, AlreadyAdopted),
    (
      'L1 serial 13',
      state('L1', 13),
      l1At14,
      Refusal.behindSource,
      Refusal.behindSource,
    ),
    (
      'L2 serial 20',
      state('L2', 20),
      l1At14,
      Refusal.foreignLineage,
      Refusal.foreignLineage,
    ),
    (
      'not json',
      utf8.encode('not json'),
      l1At14,
      Refusal.targetUnreadable,
      Refusal.targetUnreadable,
    ),
    (
      'absent, source 404',
      null,
      null,
      Refusal.sourceMissing,
      Refusal.sourceMissing,
    ),
    (
      'L1 serial 14 with other bytes',
      state('L1', 14, pad: ' '),
      l1At14,
      Refusal.copyMismatch,
      Refusal.copyMismatch,
    ),
  ];

  for (final (name, before, source, adopted, required) in table) {
    test('adopt with target $name', () async {
      final store = FakeStore(before);
      await expectLater(
        adopt(from: FakeReader(source), to: store),
        outcome(adopted),
      );
      expect(store.creates, adopted == Copied ? 1 : 0);
      expect(store.object, adopted == Copied ? source : before);
    });

    test('requireAdopted with target $name', () async {
      final store = FakeStore(before);
      await expectLater(
        requireAdopted(from: FakeReader(source), target: store),
        outcome(required),
      );
      expect(store.creates, 0);
      expect(store.object, before);
    });
  }

  test(
    'a missing or unreadable source refuses without reading the target',
    () async {
      for (final (source, reason) in [
        (null, Refusal.sourceMissing),
        (
          utf8.encode('{"lineage":"L1","serial":14.0}'),
          Refusal.sourceUnreadable,
        ),
      ]) {
        final store = FakeStore(null);
        await expectLater(
          adopt(from: FakeReader(source), to: store),
          outcome(reason),
        );
        await expectLater(
          requireAdopted(from: FakeReader(source), target: store),
          outcome(reason),
        );
        expect(store.reads, 0);
        expect(store.creates, 0);
      }
    },
  );

  test('adopt that loses the create race judges the winner once', () async {
    final store = FakeStore(null, racer: l1At14);
    await expectLater(
      adopt(from: FakeReader(l1At14), to: store),
      outcome(AlreadyAdopted),
    );
    expect(store.creates, 1);
    expect(store.reads, 2);
  });

  test('adopt refuses a create that reads back other bytes', () async {
    final store = FakeStore(null, stores: state('L1', 14, pad: ' '));
    await expectLater(
      adopt(from: FakeReader(l1At14), to: store),
      outcome(Refusal.copyMismatch),
    );
    expect(store.creates, 1);
  });

  test(
    'synthesizedStateObject names the object bin/infra.dart plans against',
    () async {
      final target = await synthesizedStateObject(
        expectedBucket: 'koborin-ai-tfstate-n-koborinai',
        accountId: 'acc-test',
      );
      expect(
        target.uri,
        'gs://koborin-ai-tfstate-n-koborinai/terraform/site/default.tfstate',
      );
    },
  );

  test(
    'synthesizedStateObject refuses an expected bucket that drifted',
    () async {
      await expectLater(
        synthesizedStateObject(
          expectedBucket: 'koborin-ai-tfstate',
          accountId: 'acc-test',
        ),
        outcome(Refusal.bucketDrift),
      );
    },
  );

  test(
    'adopt_state.dart reaches the entry point with its own account id',
    () async {
      final run = await Process.run(
        Platform.resolvedExecutable,
        ['run', 'tool/adopt_state.dart'],
        environment: {
          'CLOUDFLARE_ACCOUNT_ID': '00112233445566778899aabbccddeeff',
          'TFSTATE_BUCKET': 'not-the-synthesized-bucket',
          'GCS_ACCESS_TOKEN': 'token',
          'R2_ACCESS_KEY_ID': 'key',
          'R2_SECRET_ACCESS_KEY': 'secret',
        },
      );
      expect(run.exitCode, 1, reason: '${run.stderr}');
      expect('${run.stdout}', contains('"reason":"bucketDrift"'));
    },
  );

  test('SigV4 reproduces the published AWS signature', () {
    // "Example: GET Object" in
    // https://docs.aws.amazon.com/AmazonS3/latest/developerguide/sig-v4-header-based-auth.html
    const signer = SigV4(
      accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
      secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
      region: 'us-east-1',
      service: 's3',
    );
    final headers = signer.sign(
      'GET',
      Uri.https('examplebucket.s3.amazonaws.com', '/test.txt'),
      DateTime.utc(2013, 5, 24),
      headers: {'Range': 'bytes=0-9'},
    );
    expect(
      headers['authorization'],
      'AWS4-HMAC-SHA256 '
      'Credential=AKIAIOSFODNN7EXAMPLE/20130524/us-east-1/s3/aws4_request,'
      'SignedHeaders=host;range;x-amz-content-sha256;x-amz-date,'
      'Signature=f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41',
    );
  });
}
