import 'dart:io';

import 'package:genkit/genkit.dart';
import 'package:genkit_vertexai/genkit_vertexai.dart';

import '../domain/edition.dart';
import '../domain/models.dart';
import 'digest_model.dart';

/// Builds the system prompt: the editable [instructions] followed by the
/// reader's persona. Pure -> unit-testable.
String buildSystemPrompt({
  required String instructions,
  required Persona persona,
}) {
  return '${instructions.trim()}\n\n'
      '# 読者の人物像（技術スタック・興味関心・人柄）\n'
      '${persona.toContext()}';
}

/// Builds the user prompt: the concrete repositories for this edition. Pure.
String buildUserPrompt({
  required Selection selection,
  required String dateJst,
}) {
  String repoBlock(Repo r) {
    final b = StringBuffer()
      ..writeln('- id: ${r.id}')
      ..writeln('  url: ${r.url}')
      ..writeln('  category: ${r.category}')
      ..writeln('  description: ${r.description}');
    if (r.readme != null && r.readme!.isNotEmpty) {
      final excerpt = r.readme!.length > 2000
          ? r.readme!.substring(0, 2000)
          : r.readme!;
      b.writeln(
        '  readme_excerpt: |\n    ${excerpt.replaceAll('\n', '\n    ')}',
      );
    }
    return b.toString();
  }

  final b = StringBuffer()
    ..writeln('# 今日（$dateJst）のメイン（深掘り1本）')
    ..writeln(repoBlock(selection.main))
    ..writeln()
    ..writeln('# 今日の新着サブ（${selection.subs.length} 本。この順序・この件数だけ subs に返す）');
  if (selection.subs.isEmpty) {
    b.writeln('(なし)');
  } else {
    b.writeln(selection.subs.map(repoBlock).join('\n'));
  }
  return b.toString();
}

/// Genkit + Gemini implementation of [DigestModel]. Reads the system-prompt
/// instructions from [promptPath] on each call (so Dev UI edits take effect on
/// the next run) and sends them as a system message, with the repo data as the
/// user message. One Gemini call per edition.
class GenkitDigestModel implements DigestModel {
  final Genkit ai;
  final String promptPath;
  final String modelId;

  GenkitDigestModel(
    this.ai, {
    required this.promptPath,
    this.modelId = 'gemini-2.5-flash',
  });

  @override
  Future<Edition> generate({
    required Persona persona,
    required Selection selection,
    required String dateJst,
  }) async {
    final instructions = File(promptPath).readAsStringSync();
    final response = await ai.generate(
      model: vertexAI.gemini(modelId),
      messages: [
        Message(
          role: Role.system,
          content: [
            TextPart(
              text: buildSystemPrompt(
                instructions: instructions,
                persona: persona,
              ),
            ),
          ],
        ),
        Message(
          role: Role.user,
          content: [
            TextPart(
              text: buildUserPrompt(selection: selection, dateJst: dateJst),
            ),
          ],
        ),
      ],
      outputSchema: Edition.$schema,
    );
    final out = response.output;
    if (out == null) {
      throw StateError('Gemini returned no structured output for $dateJst');
    }
    return out;
  }
}
