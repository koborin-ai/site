import 'dart:io';
import 'package:args/args.dart';
import 'package:genkit/genkit.dart';
import 'package:genkit_vertexai/genkit_vertexai.dart';
import 'package:path/path.dart' as p;
import 'package:stars_digest/stars_digest.dart';

Future<void> main(List<String> argv) async {
  final parser = ArgParser()
    ..addOption(
      'stars-dir',
      help: 'Path to checked-out stars repo',
      mandatory: true,
    )
    ..addOption(
      'site-dir',
      help: 'Path to n-koborinai-me repo root',
      mandatory: true,
    )
    ..addOption(
      'date',
      help: 'JST date YYYY-MM-DD (defaults to today in Asia/Tokyo)',
    )
    ..addOption('max-subs', defaultsTo: '5')
    ..addFlag(
      'dry-run',
      defaultsTo: false,
      help: 'Skip Gemini, emit stub content',
    );

  final args = parser.parse(argv);
  final starsDir = args['stars-dir'] as String;
  final siteDir = args['site-dir'] as String;
  final dateJst = (args['date'] as String?) ?? todayJst();
  final maxSubs = int.parse(args['max-subs'] as String);
  final dryRun = args['dry-run'] as bool;

  final contentDocsDir = p.join(siteDir, 'app', 'src', 'content', 'docs');
  final stateFile = p.join(
    siteDir,
    'tools',
    'stars-digest',
    'state',
    'featured.json',
  );
  final steeringFile = p.join(siteDir, 'tools', 'stars-digest', 'steering.md');

  final indexMdx = File(
    p.join(contentDocsDir, 'ja', 'index.mdx'),
  ).readAsStringSync();
  final lifeDir = Directory(p.join(contentDocsDir, 'ja', 'life'));
  final lifeMdx = lifeDir
      .listSync()
      .whereType<File>()
      .where((f) => f.path.endsWith('.mdx'))
      .map((f) => f.readAsStringSync())
      .toList();
  final steering = File(steeringFile).existsSync()
      ? File(steeringFile).readAsStringSync()
      : '';

  final promptFile = p.join(
    siteDir,
    'tools',
    'stars-digest',
    'prompts',
    'digest.md',
  );
  final ai = Genkit(
    plugins: [
      vertexAI(
        projectId: dryRun ? null : requireVertexProject(Platform.environment),
        location: 'global',
      ),
    ],
  );
  final model = GenkitDigestModel(ai, promptPath: promptFile);

  final summary = await runGenerate(
    ai: ai,
    stars: GitStarsRepo(starsDir),
    model: model,
    contentDocsDir: contentDocsDir,
    stateFile: stateFile,
    indexMdx: indexMdx,
    lifeMdx: lifeMdx,
    steering: steering,
    dateJst: dateJst,
    maxSubs: maxSubs,
    dryRun: dryRun,
  );

  stdout.writeln(summary);
}
