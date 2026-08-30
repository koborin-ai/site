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

    final domain = ((json['resource']
        as Map)['cloudflare_workers_custom_domain'] as Map)['apex'] as Map;
    expect(domain['hostname'], 'koborin.ai');
    expect(domain['service'], 'koborin-ai-web');
    expect(domain['account_id'], 'acc-test');
    expect(domain['zone_id'], r'${data.cloudflare_zone.koborin.id}');
  });
}
