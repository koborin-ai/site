import 'package:terradart_core/terradart_core.dart';

/// `data.cloudflare_zone` filtered by zone name. Does not create a zone.
final class CloudflareZoneLookup extends Data {
  CloudflareZoneLookup({
    required super.localName,
    required String zoneName,
  }) : super(
          terraformType: 'cloudflare_zone',
          argMap: {
            'filter': TfArg.literal(<String, Object?>{'name': zoneName}),
          },
        );

  @override
  Set<String> get sensitiveFields => const {};

  TfRef<String> get id => TfRef.attribute<String>(this, 'id');
}
