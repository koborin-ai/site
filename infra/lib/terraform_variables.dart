/// Terraform `variable` blocks for the shared stack.
///
/// TerraDart emits [TfArg.variable] references in resource args but does not
/// yet synthesize the matching `variable` blocks (planned for terradart_core
/// v1.x). [bin/synth.dart] merges this map into `main.tf.json` so the
/// output is a single JSON root module.
const Map<String, Map<String, Object>> sharedStackTerraformVariables = {
  'oauth_client_id': {
    'type': 'string',
    'description': 'OAuth 2.0 client ID for IAP on the dev backend service.',
  },
  'oauth_client_secret': {
    'type': 'string',
    'sensitive': true,
    'description':
        'OAuth 2.0 client secret for IAP on the dev backend service.',
  },
  'iap_user': {
    'type': 'string',
    'description': 'Google account email allowed to access dev via IAP.',
  },
};

/// Terraform `variable` blocks for the dev stack.
const Map<String, Map<String, Object>> devStackTerraformVariables = {
  'image_uri': {
    'type': 'string',
    'description':
        'Container image URI for the dev Cloud Run service (Artifact Registry).',
  },
};

/// Terraform `variable` blocks for the site stack.
///
/// Site values are injected at synth time from environment variables, not
/// Terraform variables.
const Map<String, Map<String, Object>> siteStackTerraformVariables = {};

/// Terraform `variable` blocks for the prod stack.
const Map<String, Map<String, Object>> prodStackTerraformVariables = {
  'image_uri': {
    'type': 'string',
    'description':
        'Container image URI for the prod Cloud Run service (Artifact Registry).',
  },
};
