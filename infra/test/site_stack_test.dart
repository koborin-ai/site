import 'package:koborin_ai_infra/site_stack.dart';
import 'package:terradart_core/terradart_core.dart';
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

  test('site stack addresses state at the R2 site key', () {
    final stack = SiteStack(
      accountId: 'acc-test',
      zoneName: 'koborin.ai',
      workerName: 'koborin-ai-web',
      backend: S3Backend.r2(
        accountId: 'acc-test',
        bucket: 'koborin-ai-tfstate',
        key: 'terraform/site/terraform.tfstate',
      ),
    );
    final backend =
        (((stack.synth().tfJson['terraform'] as Map)['backend'] as Map)['s3']
            as Map);

    expect(backend['bucket'], 'koborin-ai-tfstate');
    expect(backend['key'], 'terraform/site/terraform.tfstate');
    expect(backend['endpoints'], {
      's3': 'https://acc-test.r2.cloudflarestorage.com',
    });
    expect(backend.containsKey('access_key'), isFalse);
    expect(backend.containsKey('secret_key'), isFalse);
  });
}
