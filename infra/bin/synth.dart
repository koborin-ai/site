/// Synth entry point for koborin.ai infrastructure stacks.
///
/// Run `dart run bin/synth.dart <stack>` to emit a single `main.tf.json`
/// under `tf-out/<stack>/`. Supported stacks: shared, dev, prod.
///
/// Required environment variables:
/// - `GCP_PROJECT_ID` (all stacks)
/// - `GCP_PROJECT_NUMBER` (shared, dev)
library;

import 'dart:convert';
import 'dart:io';

import 'package:koborin_ai_infra/dev_stack.dart';
import 'package:koborin_ai_infra/prod_stack.dart';
import 'package:koborin_ai_infra/shared_stack.dart';
import 'package:koborin_ai_infra/terraform_variables.dart';
import 'package:terradart_core/terradart_core.dart';

Future<void> main(List<String> args) async {
  final stackName = args.isNotEmpty ? args.first : 'shared';

  switch (stackName) {
    case 'shared':
      await _synthShared();
      return;
    case 'dev':
      await _synthDev();
      return;
    case 'prod':
      await _synthProd();
      return;
    default:
      stderr.writeln(
        'error: unknown stack "$stackName". Valid stacks: shared, dev, prod',
      );
      exit(64);
  }
}

Future<void> _synthShared() async {
  final projectId = _requireEnv('GCP_PROJECT_ID');
  final projectNumber = _requireEnv('GCP_PROJECT_NUMBER');

  const outputDir = 'tf-out/shared';
  final stack = SharedStack(
    projectId: projectId,
    projectNumber: projectNumber,
  );

  await _synthStack(
    outputDir: outputDir,
    stack: stack,
    variables: sharedStackTerraformVariables,
    backendPrefix: 'terraform/shared',
  );
}

Future<void> _synthDev() async {
  final projectId = _requireEnv('GCP_PROJECT_ID');
  final projectNumber = _requireEnv('GCP_PROJECT_NUMBER');

  const outputDir = 'tf-out/dev';
  final stack = DevStack(
    projectId: projectId,
    projectNumber: projectNumber,
  );

  await _synthStack(
    outputDir: outputDir,
    stack: stack,
    variables: devStackTerraformVariables,
    backendPrefix: 'terraform/dev',
  );
}

Future<void> _synthProd() async {
  final projectId = _requireEnv('GCP_PROJECT_ID');

  const outputDir = 'tf-out/prod';
  final stack = ProdStack(projectId: projectId);

  await _synthStack(
    outputDir: outputDir,
    stack: stack,
    variables: prodStackTerraformVariables,
    backendPrefix: 'terraform/prod',
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
  final tfJson = Map<String, dynamic>.from(result.tfJson)
    ..['variable'] = variables;

  if (Platform.environment['TERRAFORM_BACKEND'] == 'gcs') {
    final terraform = Map<String, dynamic>.from(
      tfJson['terraform'] as Map<String, dynamic>,
    );
    terraform['backend'] = {
      'gcs': {
        'bucket':
            Platform.environment['TERRAFORM_STATE_BUCKET'] ??
                'n-koborinai-me-backend',
        'prefix': backendPrefix,
      },
    };
    tfJson['terraform'] = terraform;
  }

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
