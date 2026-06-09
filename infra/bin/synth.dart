/// Synth entry point for koborin.ai infrastructure stacks.
///
/// Run `dart run bin/synth.dart shared` to emit a single `main.tf.json`
/// under `tf-out/<stack>/`.
///
/// Required environment variables:
/// - `GCP_PROJECT_ID`
/// - `GCP_PROJECT_NUMBER` (shared stack only)
library;

import 'dart:convert';
import 'dart:io';

import 'package:koborin_ai_infra/shared_stack.dart';
import 'package:koborin_ai_infra/terraform_variables.dart';

Future<void> main(List<String> args) async {
  final stackName = args.isNotEmpty ? args.first : 'shared';

  switch (stackName) {
    case 'shared':
      await _synthShared();
      return;
    default:
      stderr.writeln(
        'error: unknown stack "$stackName". Valid stacks: shared',
      );
      exit(64);
  }
}

Future<void> _synthShared() async {
  final projectId = Platform.environment['GCP_PROJECT_ID'];
  final projectNumber = Platform.environment['GCP_PROJECT_NUMBER'];

  if (projectId == null || projectId.isEmpty) {
    stderr.writeln(
      'error: set GCP_PROJECT_ID (e.g. GCP_PROJECT_ID=my-proj-123)',
    );
    exit(64);
  }
  if (projectNumber == null || projectNumber.isEmpty) {
    stderr.writeln(
      'error: set GCP_PROJECT_NUMBER for shared stack '
      '(e.g. GCP_PROJECT_NUMBER=123456789012)',
    );
    exit(64);
  }

  const outputDir = 'tf-out/shared';
  final stack = SharedStack(
    projectId: projectId,
    projectNumber: projectNumber,
  );

  await _cleanOutputDir(outputDir);

  final result = stack.synth();
  final tfJson = Map<String, dynamic>.from(result.tfJson)
    ..['variable'] = sharedStackTerraformVariables;

  if (Platform.environment['TERRAFORM_BACKEND'] == 'gcs') {
    final terraform = Map<String, dynamic>.from(
      tfJson['terraform'] as Map<String, dynamic>,
    );
    terraform['backend'] = {
      'gcs': {
        'bucket':
            Platform.environment['TERRAFORM_STATE_BUCKET'] ??
                'n-koborinai-me-backend',
        'prefix': 'terraform/shared',
      },
    };
    tfJson['terraform'] = terraform;
  }

  final out = Directory(outputDir);
  await out.create(recursive: true);
  await File('${out.path}/main.tf.json').writeAsString(
    const JsonEncoder.withIndent('  ').convert(tfJson),
  );

  stdout.writeln('synthesized shared stack to $outputDir/main.tf.json');
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
