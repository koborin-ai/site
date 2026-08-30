/// Synth entry point for koborin.ai infrastructure.
///
/// Run `dart run bin/synth.dart` to emit `tf-out/site/main.tf.json`.
///
/// Set `CLOUDFLARE_ACCOUNT_ID`. Apply-time credentials
/// (`CLOUDFLARE_API_TOKEN`, and the R2 keys the backend reads through
/// `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`) never reach synth.
library;

import 'dart:io';

import 'package:koborin_ai_infra/site_stack.dart';
import 'package:terradart_core/terradart_core.dart';

const _outputDir = 'tf-out/site';
const _stateBucket = 'koborin-ai-tfstate';
const _stateKey = 'terraform/site/terraform.tfstate';

Future<void> main() async {
  final accountId = Platform.environment['CLOUDFLARE_ACCOUNT_ID']!;

  final stack = SiteStack(
    accountId: accountId,
    zoneName: 'koborin.ai',
    workerName: 'koborin-ai-web',
    backend: S3Backend.r2(
      accountId: accountId,
      bucket: _stateBucket,
      key: _stateKey,
    ),
  );

  await stack.writeTo(_outputDir);
  stdout.writeln('synthesized stack to $_outputDir/main.tf.json');
}
