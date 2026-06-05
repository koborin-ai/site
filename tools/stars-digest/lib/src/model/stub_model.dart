import '../domain/edition.dart';
import '../domain/models.dart';
import 'digest_model.dart';

/// A [DigestModel] that returns deterministic stub content without calling an
/// LLM. Used by `--dry-run` and the dev flow to exercise the pipeline offline.
class StubDigestModel implements DigestModel {
  @override
  Future<Edition> generate({
    required Persona persona,
    required Selection selection,
    required String dateJst,
  }) async => Edition(
    title: '[dry-run] $dateJst の号',
    intro: '(dry-run のためダミー本文です)',
    main: MainContent(
      hook: 'dry-run',
      whatItIs: selection.main.description,
      whyItResonates: '-',
      useCases: const ['-'],
      firstStep: '-',
    ),
    subs: [
      for (final s in selection.subs)
        SubContent(oneLine: s.description, hook: '-'),
    ],
  );
}
