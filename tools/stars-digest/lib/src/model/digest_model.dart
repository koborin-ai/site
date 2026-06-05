import '../domain/edition.dart';
import '../domain/models.dart';

/// Generates the prose for one edition. Implementations are swappable
/// (real: Genkit+Gemini; tests: a fake) so all callers stay testable.
abstract interface class DigestModel {
  Future<Edition> generate({
    required Persona persona,
    required Selection selection,
    required String dateJst,
  });
}
