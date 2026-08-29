import 'package:terradart_core/terradart_core.dart';

/// Local wrapper. terradart_cloudflare does not ship this resource.
final class CloudflareWorkersCustomDomain extends Resource {
  static const String tfType = 'cloudflare_workers_custom_domain';

  CloudflareWorkersCustomDomain({
    required super.localName,
    required TfArg<String> accountId,
    required TfArg<String> hostname,
    required TfArg<String> service,
    required TfArg<String> zoneId,
    super.dependsOn,
  }) : super(
          terraformType: tfType,
          argMap: {
            'account_id': accountId,
            'hostname': hostname,
            'service': service,
            'zone_id': zoneId,
          },
        );

  @override
  Set<String> get sensitiveFields => const {};
}
