/// Synth entry point for koborin.ai infrastructure.
///
/// Run `dart run bin/synth.dart site` to emit `tf-out/site/main.tf.json`.
///
/// Required environment variables:
/// - `CLOUDFLARE_ACCOUNT_ID`
/// - `SITE_APEX_CONTENT` (used when `SITE_ATTACH_CUSTOM_DOMAIN` is not true)
library;

import 'dart:io';

import 'package:koborin_ai_infra/r2_backend.dart';
import 'package:koborin_ai_infra/site_stack.dart';

Future<void> main(List<String> args) async {
  final stackName = args.isNotEmpty ? args.first : 'site';
  if (stackName != 'site') {
    stderr.writeln('error: unknown stack "$stackName". Valid stacks: site');
    exit(64);
  }

  final accountId = _requireEnv('CLOUDFLARE_ACCOUNT_ID');
  final attachCustomDomain =
      Platform.environment['SITE_ATTACH_CUSTOM_DOMAIN'] == 'true';
  final apexContent = attachCustomDomain
      ? (Platform.environment['SITE_APEX_CONTENT'] ?? '203.0.113.10')
      : _requireEnv('SITE_APEX_CONTENT');

  const outputDir = 'tf-out/site';
  final stack = SiteStack(
    accountId: accountId,
    zoneName: 'koborin.ai',
    workerName: 'koborin-ai-web',
    attachCustomDomain: attachCustomDomain,
    apexName: 'koborin.ai',
    apexContent: apexContent,
    apexTtl: _envNum('SITE_APEX_TTL', 1),
    apexProxied: Platform.environment['SITE_APEX_PROXIED'] == 'true',
    backend: R2Backend(
      bucket: Platform.environment['TERRAFORM_STATE_BUCKET'] ??
          'koborin-ai-tfstate',
      key: 'terraform/site/terraform.tfstate',
      accountId: accountId,
    ),
  );

  await stack.writeTo(outputDir);
  stdout.writeln('synthesized stack to $outputDir/main.tf.json');
}

String _requireEnv(String name) {
  final value = Platform.environment[name];
  if (value == null || value.isEmpty) {
    stderr.writeln('error: set $name (e.g. $name=my-value)');
    exit(64);
  }
  return value;
}

/// GitHub Actions injects `${{ vars.NAME }}` as `""` when the variable is
/// missing, so `?? fallback` does not apply.
num _envNum(String name, num fallback) {
  final raw = Platform.environment[name];
  if (raw == null || raw.isEmpty) {
    return fallback;
  }
  return num.parse(raw);
}
