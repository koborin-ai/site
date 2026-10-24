import 'package:terradart_cloudflare/data.dart';
import 'package:terradart_cloudflare/provider.dart';
import 'package:terradart_cloudflare/workers.dart';

final class SiteStack extends Stack {
  SiteStack({
    required String accountId,
    required String zoneName,
    required String workerName,
    super.backend,
  }) : super(providers: [const CloudflareProvider()]) {
    final zone = add(
      DataCloudflareZone(
        'koborin',
        filter: DataZoneFilter(name: TfArg.literal(zoneName)),
      ),
    );

    add(
      CloudflareWorkersCustomDomain(
        'apex',
        accountId: RefTo.literal(accountId),
        hostname: TfArg.literal(zoneName),
        service: TfArg.literal(workerName),
        zoneId: zone.ref,
      ),
    );
  }
}
