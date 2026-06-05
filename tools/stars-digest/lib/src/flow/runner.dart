import 'dart:convert';
import 'dart:io';

import 'package:genkit/genkit.dart';
import 'package:path/path.dart' as p;

import '../domain/models.dart';
import '../domain/state.dart';
import '../io/stars_repo.dart';
import '../model/digest_model.dart';
import '../pipeline/render.dart';
import 'flow.dart';
import 'flow_input.dart';

/// Generates today's edition by running the shared `starsDigest` flow, writes
/// the page + regenerated index + updated state, and returns a summary.
Future<String> runGenerate({
  required Genkit ai,
  required StarsRepo stars,
  required DigestModel model,
  required String contentDocsDir,
  required String stateFile,
  required String indexMdx,
  required List<String> lifeMdx,
  required String steering,
  required String dateJst,
  int maxSubs = 5,
  bool dryRun = false,
}) async {
  final state = _readState(stateFile);
  final flow = defineStarsDigestFlow(
    ai,
    StarsDigestDeps(
      stars: stars,
      indexMdx: indexMdx,
      lifeMdx: lifeMdx,
      steering: steering,
      state: state,
      model: model,
    ),
  );
  final result = await flow(
    DigestFlowInput(dateJst: dateJst, maxSubs: maxSubs, dryRun: dryRun),
  );

  final starsDir = Directory(p.join(contentDocsDir, 'stars'))
    ..createSync(recursive: true);
  File(
    p.join(starsDir.path, '$dateJst.md'),
  ).writeAsStringSync(renderEdition(result));

  final metas = _existingMetas(starsDir, currentDate: dateJst)
    ..add(editionMetaFrom(result));
  File(
    p.join(starsDir.path, 'index.md'),
  ).writeAsStringSync(renderIndex(editions: metas));

  final next = state.withMainFeatured(result.main.id, sha: stars.headSha());
  File(stateFile).writeAsStringSync(
    '${const JsonEncoder.withIndent('  ').convert(next.toJson())}\n',
  );

  return '$dateJst — 発掘: ${result.main.id} / 新着 ${result.subs.length + result.overflow.length} 件';
}

DigestState _readState(String path) {
  final f = File(path);
  if (!f.existsSync()) return const DigestState();
  final raw = f.readAsStringSync().trim();
  if (raw.isEmpty) return const DigestState();
  return DigestState.fromJson(jsonDecode(raw) as Map<String, dynamic>);
}

/// Collects metadata from previously generated edition files (frontmatter),
/// excluding [currentDate] (it is appended fresh by the caller).
List<EditionMeta> _existingMetas(
  Directory starsDir, {
  required String currentDate,
}) {
  final dateRe = RegExp(r'^\d{4}-\d{2}-\d{2}$');
  final titleRe = RegExp(r'^title:\s*"?(.*?)"?\s*$', multiLine: true);
  final descRe = RegExp(r'^description:\s*"?(.*?)"?\s*$', multiLine: true);
  final metas = <EditionMeta>[];
  for (final f in starsDir.listSync().whereType<File>()) {
    final name = p.basenameWithoutExtension(f.path);
    if (!dateRe.hasMatch(name) || name == currentDate) continue;
    final text = f.readAsStringSync();
    metas.add(
      EditionMeta(
        dateJst: name,
        title: titleRe.firstMatch(text)?.group(1) ?? name,
        description: descRe.firstMatch(text)?.group(1) ?? '',
      ),
    );
  }
  return metas;
}
