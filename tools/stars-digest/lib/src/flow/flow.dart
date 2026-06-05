import 'package:genkit/genkit.dart';

import '../domain/edition.dart';
import '../domain/models.dart';
import '../domain/state.dart';
import '../io/clock.dart';
import '../io/stars_repo.dart';
import '../model/digest_model.dart';
import '../model/stub_model.dart';
import '../pipeline/new_arrivals.dart';
import '../pipeline/persona_builder.dart';
import '../pipeline/selector.dart';
import '../pipeline/source.dart';
import 'flow_input.dart';

/// Inputs the flow needs beyond the per-run JSON input. Captured when the flow
/// is defined; identical for production and the Dev UI.
class StarsDigestDeps {
  final StarsRepo stars;
  final String indexMdx;
  final List<String> lifeMdx;
  final String steering;
  final DigestState state;
  final DigestModel
  model; // real model (e.g. GenkitDigestModel(ai)); stubbed per-run when dryRun

  const StarsDigestDeps({
    required this.stars,
    required this.indexMdx,
    required this.lifeMdx,
    required this.steering,
    required this.state,
    required this.model,
  });
}

RepoRef _ref(Repo r) => RepoRef(
  id: r.id,
  url: r.url,
  category: r.category,
  language: r.language,
  stars: r.stars,
);

/// Defines the single 'starsDigest' generation flow on [ai] and returns the
/// callable flow. The flow runs the full pipeline (parse stars -> detect new
/// arrivals -> build persona -> select -> generate) and returns a [DigestResult].
/// Used by both production (run programmatically) and the Dev UI.
Flow<DigestFlowInput, DigestResult, dynamic, dynamic> defineStarsDigestFlow(
  Genkit ai,
  StarsDigestDeps deps,
) {
  return ai.defineFlow(
    name: 'starsDigest',
    inputSchema: DigestFlowInput.$schema,
    outputSchema: DigestResult.$schema,
    fn: (DigestFlowInput input, _) async {
      final dateJst = (input.dateJst?.isNotEmpty ?? false)
          ? input.dateJst!
          : todayJst();
      final maxSubs = input.maxSubs ?? 5;

      final newLlmsTxt = deps.stars.readLlmsTxt();
      final repos = StarsSource.parse(
        llmsTxt: newLlmsTxt,
        llmsFull: deps.stars.readLlmsFull(),
      );
      final baseline = deps.state.lastProcessedStarsSha == null
          ? ''
          : (deps.stars.showLlmsTxtAt(deps.state.lastProcessedStarsSha!) ?? '');
      final newIds = detectNewArrivals(
        oldLlmsTxt: baseline,
        newLlmsTxt: newLlmsTxt,
      );
      final persona = buildPersona(
        indexMdx: deps.indexMdx,
        lifeMdx: deps.lifeMdx,
        steering: deps.steering,
      );
      final selection = selectEdition(
        repos: repos,
        newArrivalIds: newIds,
        featuredIds: deps.state.mainFeatured,
        dateSeed: dateJst,
        maxSubs: maxSubs,
      );
      final model = (input.dryRun ?? false) ? StubDigestModel() : deps.model;
      final edition = await model.generate(
        persona: persona,
        selection: selection,
        dateJst: dateJst,
      );
      return DigestResult(
        dateJst: dateJst,
        edition: edition,
        main: _ref(selection.main),
        subs: [for (final r in selection.subs) _ref(r)],
        overflow: [for (final r in selection.overflow) _ref(r)],
      );
    },
  );
}
