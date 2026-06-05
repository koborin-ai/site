import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:genkit/genkit.dart';
import 'package:genkit_vertexai/genkit_vertexai.dart';
import 'package:path/path.dart' as p;
import 'package:stars_digest/stars_digest.dart';

/// Dev entrypoint: exposes the newsletter generation as a Genkit flow for the
/// Genkit Developer UI so the prompt and Edition output can be iterated on.
///
/// Run (genkit sets GENKIT_ENV=dev, which auto-starts the reflection server):
///   gcloud auth application-default login; export GOOGLE_CLOUD_PROJECT=<project>  # not needed for dryRun
///   genkit start -o -- dart run bin/dev.dart
/// Then run the `starsDigest` flow from the Dev UI.
///
/// STARS_DIR and SITE_DIR are auto-detected for the standard sibling layout
/// (StudioProjects/{stars, n-koborinai-me}); set those env vars only to override.
Future<void> main() async {
  final ai = Genkit(
    plugins: [
      vertexAI(
        projectId: Platform.environment['GOOGLE_CLOUD_PROJECT'],
        location: 'global',
      ),
    ],
  );

  final siteDir = _dir('SITE_DIR', _defaultSiteDir());
  final starsDir = _dir(
    'STARS_DIR',
    p.normalize(p.join(siteDir, '..', 'stars')),
  );
  final contentDocsDir = p.join(siteDir, 'app', 'src', 'content', 'docs');
  final steeringFile = p.join(siteDir, 'tools', 'stars-digest', 'steering.md');
  final stateFile = p.join(
    siteDir,
    'tools',
    'stars-digest',
    'state',
    'featured.json',
  );

  final indexMdx = File(
    p.join(contentDocsDir, 'ja', 'index.mdx'),
  ).readAsStringSync();
  final lifeMdx = Directory(p.join(contentDocsDir, 'ja', 'life'))
      .listSync()
      .whereType<File>()
      .where((f) => f.path.endsWith('.mdx'))
      .map((f) => f.readAsStringSync())
      .toList();
  final steering = File(steeringFile).existsSync()
      ? File(steeringFile).readAsStringSync()
      : '';
  final state =
      File(stateFile).existsSync() &&
          File(stateFile).readAsStringSync().trim().isNotEmpty
      ? DigestState.fromJson(
          jsonDecode(File(stateFile).readAsStringSync())
              as Map<String, dynamic>,
        )
      : const DigestState();

  defineStarsDigestFlow(
    ai,
    StarsDigestDeps(
      stars: GitStarsRepo(starsDir),
      indexMdx: indexMdx,
      lifeMdx: lifeMdx,
      steering: steering,
      state: state,
      model: GenkitDigestModel(
        ai,
        promptPath: p.join(
          siteDir,
          'tools',
          'stars-digest',
          'prompts',
          'digest.md',
        ),
      ),
    ),
  );

  stderr.writeln(
    'starsDigest flow registered. Open the Genkit Dev UI to run it.',
  );
  await Completer<void>().future; // keep the reflection server alive
}

/// Resolves a directory: uses [envKey] if set and existing; otherwise falls
/// back to the auto-detected [fallback]. A set-but-missing env value (e.g. a
/// stale placeholder export) is ignored with a warning rather than failing.
String _dir(String envKey, String fallback) {
  final v = Platform.environment[envKey];
  if (v != null && v.isNotEmpty && Directory(v).existsSync()) return v;
  if (v != null && v.isNotEmpty) {
    stderr.writeln(
      'Warning: $envKey="$v" does not exist; using auto-detected "$fallback".',
    );
  }
  if (Directory(fallback).existsSync()) return fallback;
  throw StateError(
    '$envKey could not be resolved ("$v" / "$fallback" do not exist). '
    'Set $envKey to an absolute path.',
  );
}

/// dev.dart lives at <site>/tools/stars-digest/bin/dev.dart, so the site root
/// is three directories up from the script's directory.
String _defaultSiteDir() {
  final binDir = p.dirname(Platform.script.toFilePath());
  return p.normalize(p.join(binDir, '..', '..', '..'));
}
