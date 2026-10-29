import 'dart:io';

import 'package:koborin_ai_infra/site_stack.dart';
import 'package:terradart_core/terradart_core.dart';

const _outputDir = 'tf-out/site';

Future<void> main(List<String> args) {
  final accountId = Platform.environment['CLOUDFLARE_ACCOUNT_ID']!;
  return runStack(
    args,
    () => SiteStack(
      accountId: accountId,
      zoneName: 'koborin.ai',
      workerName: 'koborin-ai-web',
      backend: GcsBackend(
        bucket: 'koborin-ai-tfstate-n-koborinai',
        prefix: 'terraform/site',
      ),
    ),
    out: _outputDir,
  );
}
