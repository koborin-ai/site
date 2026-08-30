import 'package:terradart_cloudflare/data.dart';
import 'package:terradart_cloudflare/provider.dart';
import 'package:terradart_cloudflare/workers.dart';
import 'package:terradart_core/terradart_core.dart';

/// Cloudflare edge for koborin.ai: the apex hostname bound to the Worker
/// that serves the site. Does not upload Worker assets — `wrangler deploy`
/// does that.
final class SiteStack extends Stack {
  SiteStack({
    required String accountId,
    required String zoneName,
    required String workerName,
    super.backend,
  }) : super(providers: [const CloudflareProvider()]) {
    final zone = addData(
      DataCloudflareZone(
        localName: 'koborin',
        filter: DataZoneFilter(name: TfArg.literal(zoneName)),
      ),
    );

    add(
      CloudflareWorkersCustomDomain(
        localName: 'apex',
        accountId: TfArg.literal(accountId),
        hostname: TfArg.literal(zoneName),
        service: TfArg.literal(workerName),
        zoneId: TfArg.ref(zone.id),
      ),
    );
  }
}
