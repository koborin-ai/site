/// Synth entry point for koborin.ai infrastructure.
///
/// Run `dart run bin/synth.dart site` to emit `tf-out/site/main.tf.json`.
///
/// Required environment variables:
/// - `CLOUDFLARE_ACCOUNT_ID`
/// - `SITE_APEX_CONTENT` (used when `SITE_ATTACH_CUSTOM_DOMAIN` is not true)
library;

import 'dart:convert';
import 'dart:io';

import 'package:koborin_ai_infra/site_stack.dart';
import 'package:koborin_ai_infra/terraform_variables.dart';
import 'package:terradart_core/terradart_core.dart';

Future<void> main(List<String> args) async {
  final stackName = args.isNotEmpty ? args.first : 'site';

  switch (stackName) {
    case 'site':
      await _synthSite();
      return;
    default:
      stderr.writeln(
        'error: unknown stack "$stackName". Valid stacks: site',
      );
      exit(64);
  }
}

Future<void> _synthSite() async {
  final accountId = _requireEnv('CLOUDFLARE_ACCOUNT_ID');
  final attachCustomDomain =
      Platform.environment['SITE_ATTACH_CUSTOM_DOMAIN'] == 'true';
  final apexContent = attachCustomDomain
      ? (Platform.environment['SITE_APEX_CONTENT'] ?? '203.0.113.10')
      : _requireEnv('SITE_APEX_CONTENT');
  final apexTtl = num.parse(Platform.environment['SITE_APEX_TTL'] ?? '1');
  final apexProxied = Platform.environment['SITE_APEX_PROXIED'] == 'true';

  const outputDir = 'tf-out/site';
  final stack = SiteStack(
    accountId: accountId,
    zoneName: 'koborin.ai',
    workerName: 'koborin-ai-web',
    attachCustomDomain: attachCustomDomain,
    apexName: 'koborin.ai',
    apexContent: apexContent,
    apexTtl: apexTtl,
    apexProxied: apexProxied,
  );

  await _synthStack(
    outputDir: outputDir,
    stack: stack,
    variables: siteStackTerraformVariables,
    backendPrefix: 'terraform/site',
  );
}

Future<void> _synthStack({
  required String outputDir,
  required Stack stack,
  required Map<String, Map<String, Object>> variables,
  required String backendPrefix,
}) async {
  await _cleanOutputDir(outputDir);

  final result = stack.synth();
  final tfJson = Map<String, dynamic>.from(result.tfJson);
  if (variables.isNotEmpty) {
    tfJson['variable'] = variables;
  }

  final accountId = _requireEnv('CLOUDFLARE_ACCOUNT_ID');
  final bucket = Platform.environment['TERRAFORM_STATE_BUCKET'] ??
      'koborin-ai-tfstate';
  final terraform = Map<String, dynamic>.from(
    tfJson['terraform'] as Map<String, dynamic>,
  );
  terraform['backend'] = {
    's3': {
      'bucket': bucket,
      'key': '$backendPrefix/terraform.tfstate',
      'region': 'auto',
      'endpoints': {
        's3': 'https://$accountId.r2.cloudflarestorage.com',
      },
      'skip_credentials_validation': true,
      'skip_region_validation': true,
      'skip_requesting_account_id': true,
      'skip_metadata_api_check': true,
      'skip_s3_checksum': true,
      'use_path_style': true,
    },
  };
  tfJson['terraform'] = terraform;

  final out = Directory(outputDir);
  await out.create(recursive: true);
  await File('${out.path}/main.tf.json').writeAsString(
    const JsonEncoder.withIndent('  ').convert(tfJson),
  );

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

Future<void> _cleanOutputDir(String outputDir) async {
  final dir = Directory(outputDir);
  if (!dir.existsSync()) {
    return;
  }
  await for (final entity in dir.list()) {
    await entity.delete(recursive: true);
  }
}
