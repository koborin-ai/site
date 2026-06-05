import 'dart:io';
import 'package:path/path.dart' as p;

/// Read-only access to a checked-out `stars` repository.
abstract interface class StarsRepo {
  String headSha();
  String readLlmsTxt();
  String readLlmsFull();

  /// Content of `llms.txt` at [sha], or null if unavailable (e.g. first run).
  String? showLlmsTxtAt(String sha);
}

/// Git-backed implementation over a local checkout directory.
class GitStarsRepo implements StarsRepo {
  final String dir;
  GitStarsRepo(this.dir);

  @override
  String headSha() => _git(['rev-parse', 'HEAD']).trim();

  @override
  String readLlmsTxt() => File(p.join(dir, 'llms.txt')).readAsStringSync();

  @override
  String readLlmsFull() => File(p.join(dir, 'llms-full.md')).readAsStringSync();

  @override
  String? showLlmsTxtAt(String sha) {
    final res = Process.runSync('git', ['-C', dir, 'show', '$sha:llms.txt']);
    if (res.exitCode != 0) return null;
    return res.stdout as String;
  }

  String _git(List<String> args) {
    final res = Process.runSync('git', ['-C', dir, ...args]);
    if (res.exitCode != 0) {
      throw ProcessException('git', args, res.stderr.toString(), res.exitCode);
    }
    return res.stdout as String;
  }
}
