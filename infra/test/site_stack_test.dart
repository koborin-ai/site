import 'dart:convert';
import 'dart:io';

import 'package:koborin_ai_infra/site_stack.dart';
import 'package:test/test.dart';

void main() {
  test('site stack binds the apex to the Worker via a zone lookup', () {
    final stack = SiteStack(
      accountId: 'acc-test',
      zoneName: 'koborin.ai',
      workerName: 'koborin-ai-web',
    );
    final json = stack.synth().tfJson;

    final zone = (json['data'] as Map)['cloudflare_zone'] as Map;
    expect((zone['koborin'] as Map)['filter'], {'name': 'koborin.ai'});

    final domain =
        ((json['resource'] as Map)['cloudflare_workers_custom_domain']
                as Map)['apex']
            as Map;
    expect(domain['hostname'], 'koborin.ai');
    expect(domain['service'], 'koborin-ai-web');
    expect(domain['account_id'], 'acc-test');
    expect(domain['zone_id'], r'${data.cloudflare_zone.koborin.id}');
  });

  test(
    'the entry point keeps state in the GCS site prefix and nothing else',
    () async {
      final temp = Directory.systemTemp.createTempSync('infra');
      addTearDown(() => temp.deleteSync(recursive: true));
      final manifest = '${temp.path}/manifest.json';
      final run = await Process.run(
        Platform.resolvedExecutable,
        ['run', 'bin/infra.dart'],
        environment: {
          'CLOUDFLARE_ACCOUNT_ID': 'acc-test',
          'TERRADART_MANIFEST': manifest,
        },
      );
      expect(run.exitCode, 0, reason: '${run.stderr}');

      final root =
          (jsonDecode(File(manifest).readAsStringSync())['roots'] as List)
                  .single
              as Map;
      final tf =
          jsonDecode(File('${root['dir']}/main.tf.json').readAsStringSync())
              as Map;
      expect((tf['terraform'] as Map)['backend'], {
        'gcs': {
          'bucket': 'koborin-ai-tfstate-n-koborinai',
          'prefix': 'terraform/site',
        },
      });
      expect(root['workspace'], isNull);
      expect(root['backend_config'], isEmpty);
    },
  );
}
