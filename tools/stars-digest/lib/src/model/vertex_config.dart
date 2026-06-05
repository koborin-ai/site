/// Resolves the GCP project for Vertex AI from the environment.
///
/// Throws [StateError] when `GOOGLE_CLOUD_PROJECT` is missing or empty so real
/// (non-dry-run) generation fails fast with a clear message instead of a deep
/// auth error later.
String requireVertexProject(Map<String, String> env) {
  final project = env['GOOGLE_CLOUD_PROJECT'];
  if (project == null || project.isEmpty) {
    throw StateError(
      'GOOGLE_CLOUD_PROJECT is not set. Run `gcloud auth application-default '
      'login` and `export GOOGLE_CLOUD_PROJECT=<project>` (or pass --dry-run).',
    );
  }
  return project;
}
