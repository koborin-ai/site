import 'package:terradart_core/terradart_core.dart';

/// `terraform { backend "s3" { ... } }` pointed at Cloudflare R2.
///
/// Local stand-in until terradart_core ships an `S3Backend`.
final class R2Backend implements StackBackend {
  const R2Backend({
    required this.bucket,
    required this.key,
    required this.accountId,
  });

  final String bucket;
  final String key;
  final String accountId;

  @override
  String get backendType => 's3';

  @override
  Map<String, Object?> toTfJson() => {
        'bucket': bucket,
        'key': key,
        'region': 'auto',
        'endpoints': {'s3': 'https://$accountId.r2.cloudflarestorage.com'},
        'skip_credentials_validation': true,
        'skip_region_validation': true,
        'skip_requesting_account_id': true,
        'skip_metadata_api_check': true,
        'skip_s3_checksum': true,
        'use_path_style': true,
      };
}
