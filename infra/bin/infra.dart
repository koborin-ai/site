/// Entry point the `terradart` command runs before plan and apply.
///
/// `CLOUDFLARE_ACCOUNT_ID` is the only value read here. The API token and
/// the R2 keys stay in the process environment for OpenTofu. Synth does not
/// write them into `main.tf.json`.
library;

import 'dart:io';

import 'package:koborin_ai_infra/site_stack.dart';
import 'package:terradart_core/terradart_core.dart';

const _outputDir = 'tf-out/site';
const _stateBucket = 'koborin-ai-tfstate';
const _stateKey = 'terraform/site/terraform.tfstate';

Future<void> main(List<String> args) {
  final accountId = Platform.environment['CLOUDFLARE_ACCOUNT_ID']!;
  return runStack(
    args,
    () => SiteStack(
      accountId: accountId,
      zoneName: 'koborin.ai',
      workerName: 'koborin-ai-web',
      backend: S3Backend.r2(
        accountId: accountId,
        bucket: _stateBucket,
        key: _stateKey,
      ),
    ),
    out: _outputDir,
  );
}
