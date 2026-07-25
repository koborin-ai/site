import 'package:genkit/genkit.dart';

import '../domain/edition.dart';
import '../domain/models.dart';
import 'digest_model.dart';

/// Builds the template input for `prompts/digest.prompt`. Pure -> unit-testable.
Map<String, dynamic> buildPromptInput({
  required Persona persona,
  required Selection selection,
  required String dateJst,
}) {
  return {
    'dateJst': dateJst,
    'persona': {
      'stack': persona.stack,
      'character': persona.character,
      'steering': persona.steering.trim(),
    },
    'main': _repoInput(selection.main),
    'subs': [for (final r in selection.subs) _repoInput(r)],
    'subsCount': selection.subs.length,
    'hasSubs': selection.subs.isNotEmpty,
  };
}

/// The repo fields the template needs. Truncating and indenting the readme
/// happens here because the template can do neither.
Map<String, dynamic> _repoInput(Repo r) {
  final readme = r.readme;
  final excerpt = (readme == null || readme.isEmpty)
      ? null
      : (readme.length > 2000 ? readme.substring(0, 2000) : readme).replaceAll(
          '\n',
          '\n    ',
        );
  return {
    'id': r.id,
    'url': r.url,
    'category': r.category,
    'description': r.description,
    if (excerpt != null) 'readmeExcerpt': excerpt,
  };
}

/// Genkit + Gemini implementation of [DigestModel]. The prompt itself lives in
/// `prompts/digest.prompt` and is loaded by Genkit from the prompt directory,
/// so the model id, the wording and the message split are all editable there
/// without touching Dart. The output schema stays in code so [Edition] remains
/// the single source of truth. One Gemini call per edition.
class GenkitDigestModel implements DigestModel {
  final Genkit ai;

  GenkitDigestModel(this.ai);

  @override
  Future<Edition> generate({
    required Persona persona,
    required Selection selection,
    required String dateJst,
  }) async {
    final prompt = await ai.prompt('digest');
    final response = await prompt(
      buildPromptInput(
        persona: persona,
        selection: selection,
        dateJst: dateJst,
      ),
      PromptGenerateOptions(
        output: GenerateActionOutputConfig(
          jsonSchema: Edition.$schema.jsonSchema(),
        ),
      ),
    );
    final out = response.output;
    if (out == null) {
      throw StateError('Gemini returned no structured output for $dateJst');
    }
    return Edition.$schema.parse(out);
  }
}
