/// Terraform `variable` blocks for the site stack.
///
/// Site values are injected at synth time from environment variables, not
/// Terraform variables. Keep this empty so synth omits the `variable` block;
/// Terraform rejects `variable: {}`.
const Map<String, Map<String, Object>> siteStackTerraformVariables = {};
