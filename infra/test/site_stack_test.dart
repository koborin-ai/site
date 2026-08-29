import 'package:koborin_ai_infra/site_stack.dart';
import 'package:test/test.dart';

void main() {
  test('site stack without cutover emits zone lookup and apex A record', () {
    final stack = SiteStack(
      accountId: 'acc-test',
      zoneName: 'koborin.ai',
      workerName: 'koborin-ai-web',
      attachCustomDomain: false,
      apexName: 'koborin.ai',
      apexContent: '203.0.113.10',
      apexTtl: 1,
      apexProxied: false,
    );
    final json = stack.synth().tfJson;
    final data = json['data'] as Map<String, dynamic>;
    final zone = (data['cloudflare_zone'] as Map<String, dynamic>)['koborin']
        as Map<String, dynamic>;
    expect(zone['filter'], {'name': 'koborin.ai'});

    final resources = json['resource'] as Map<String, dynamic>;
    final record =
        (resources['cloudflare_dns_record'] as Map<String, dynamic>)['apex']
            as Map<String, dynamic>;
    expect(record['name'], 'koborin.ai');
    expect(record['type'], 'A');
    expect(record['content'], '203.0.113.10');
    expect(record['proxied'], false);
    expect(resources.containsKey('cloudflare_workers_custom_domain'), isFalse);
  });

  test('site stack with cutover emits custom domain and no apex A record', () {
    final stack = SiteStack(
      accountId: 'acc-test',
      zoneName: 'koborin.ai',
      workerName: 'koborin-ai-web',
      attachCustomDomain: true,
      apexName: 'koborin.ai',
      apexContent: '203.0.113.10',
      apexTtl: 1,
      apexProxied: false,
    );
    final json = stack.synth().tfJson;
    final resources = json['resource'] as Map<String, dynamic>;
    expect(resources.containsKey('cloudflare_dns_record'), isFalse);
    final domain = (resources['cloudflare_workers_custom_domain']
        as Map<String, dynamic>)['apex'] as Map<String, dynamic>;
    expect(domain['hostname'], 'koborin.ai');
    expect(domain['service'], 'koborin-ai-web');
    expect(domain['account_id'], 'acc-test');
  });
}
