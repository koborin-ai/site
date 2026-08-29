import 'package:terradart_cloudflare/data.dart';
import 'package:terradart_cloudflare/dns.dart';
import 'package:terradart_cloudflare/provider.dart';
import 'package:terradart_cloudflare/workers.dart';
import 'package:terradart_core/terradart_core.dart';

/// Cloudflare edge for koborin.ai. Does not upload Worker assets.
final class SiteStack extends Stack {
  SiteStack({
    required String accountId,
    required String zoneName,
    required String workerName,
    required bool attachCustomDomain,
    required String apexName,
    required String apexContent,
    required num apexTtl,
    required bool apexProxied,
    super.backend,
  }) : super(providers: [const CloudflareProvider()]) {
    final zone = addData(
      DataCloudflareZone(
        localName: 'koborin',
        filter: DataZoneFilter(name: TfArg.literal(zoneName)),
      ),
    );

    if (attachCustomDomain) {
      add(
        CloudflareWorkersCustomDomain(
          localName: 'apex',
          accountId: TfArg.literal(accountId),
          hostname: TfArg.literal(zoneName),
          service: TfArg.literal(workerName),
          zoneId: TfArg.ref(zone.id),
        ),
      );
      return;
    }

    add(
      CloudflareDnsRecord(
        localName: 'apex',
        zoneId: TfArg.ref(zone.id),
        name: TfArg.literal(apexName),
        type: TfArg.literal('A'),
        ttl: TfArg.literal(apexTtl),
        content: TfArg.literal(apexContent),
        proxied: TfArg.literal(apexProxied),
      ),
    );
  }
}
