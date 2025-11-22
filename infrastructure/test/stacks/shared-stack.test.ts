import { Testing } from "cdktf"
import { describe, it, expect, beforeEach } from "vitest"
import { SharedStack } from "../../src/stacks/shared-stack"

describe("SharedStack", () => {
  let app: ReturnType<typeof Testing.app>
  let stack: SharedStack

  beforeEach(() => {
    app = Testing.app()
    stack = new SharedStack(app, "test-shared")
  })

  it("should synthesize without errors", () => {
    const synthesized = Testing.synth(stack)
    expect(synthesized).toBeTruthy()
  })

  it("should create Google Provider with correct project and region", () => {
    const synthesized = Testing.synth(stack)
    const providers = JSON.parse(synthesized).provider.google
    
    expect(providers).toBeDefined()
    expect(providers[0].region).toBe("asia-northeast1")
  })

  it("should enable all required APIs", () => {
    const synthesized = Testing.synth(stack)
    const resources = JSON.parse(synthesized).resource
    const projectServices = resources.google_project_service

    const requiredApis = [
      "run.googleapis.com",
      "compute.googleapis.com",
      "iam.googleapis.com",
      "cloudresourcemanager.googleapis.com",
      "artifactregistry.googleapis.com",
      "iap.googleapis.com",
      "monitoring.googleapis.com",
      "logging.googleapis.com",
    ]

    requiredApis.forEach((api) => {
      const serviceKey = Object.keys(projectServices).find((key) =>
        projectServices[key].service === api
      )
      expect(serviceKey).toBeDefined()
      expect(projectServices[serviceKey].disable_on_destroy).toBe(false)
    })
  })

  it("should create Artifact Registry with Docker format and immutable tags", () => {
    const synthesized = Testing.synth(stack)
    const resources = JSON.parse(synthesized).resource
    const artifactRegistry = resources.google_artifact_registry_repository

    const registryKey = Object.keys(artifactRegistry)[0]
    expect(artifactRegistry[registryKey].repository_id).toBe("koborin-ai-web")
    expect(artifactRegistry[registryKey].location).toBe("asia-northeast1")
    expect(artifactRegistry[registryKey].format).toBe("DOCKER")
    expect(artifactRegistry[registryKey].docker_config).toBeDefined()
    expect(artifactRegistry[registryKey].docker_config.immutable_tags).toBe(true)
  })

  it("should create global static IP with EXTERNAL type", () => {
    const synthesized = Testing.synth(stack)
    const resources = JSON.parse(synthesized).resource
    const globalAddress = resources.google_compute_global_address

    const addressKey = Object.keys(globalAddress)[0]
    expect(globalAddress[addressKey].name).toBe("koborin-ai-global-ip")
    expect(globalAddress[addressKey].address_type).toBe("EXTERNAL")
    expect(globalAddress[addressKey].ip_version).toBe("IPV4")
  })

  it("should create dev Serverless NEG pointing to Cloud Run service", () => {
    const synthesized = Testing.synth(stack)
    const resources = JSON.parse(synthesized).resource
    const negs = resources.google_compute_region_network_endpoint_group

    const devNegKey = Object.keys(negs).find((key) => key.includes("dev-neg"))
    expect(devNegKey).toBeDefined()
    expect(negs[devNegKey].name).toBe("koborin-ai-dev-neg")
    expect(negs[devNegKey].network_endpoint_type).toBe("SERVERLESS")
    expect(negs[devNegKey].cloud_run).toBeDefined()
    expect(negs[devNegKey].cloud_run.service).toBe("koborin-ai-web-dev")
  })

  it("should create prod Serverless NEG pointing to Cloud Run service", () => {
    const synthesized = Testing.synth(stack)
    const resources = JSON.parse(synthesized).resource
    const negs = resources.google_compute_region_network_endpoint_group

    const prodNegKey = Object.keys(negs).find((key) => key.includes("prod-neg"))
    expect(prodNegKey).toBeDefined()
    expect(negs[prodNegKey].name).toBe("koborin-ai-prod-neg")
    expect(negs[prodNegKey].network_endpoint_type).toBe("SERVERLESS")
    expect(negs[prodNegKey].cloud_run).toBeDefined()
    expect(negs[prodNegKey].cloud_run.service).toBe("koborin-ai-web-prod")
  })

  it("should create dev Backend Service with IAP enabled and noindex header", () => {
    const synthesized = Testing.synth(stack)
    const resources = JSON.parse(synthesized).resource
    const backendServices = resources.google_compute_backend_service

    const devBackendKey = Object.keys(backendServices).find((key) => key.includes("dev-backend"))
    expect(devBackendKey).toBeDefined()
    expect(backendServices[devBackendKey].name).toBe("koborin-ai-dev-backend")
    expect(backendServices[devBackendKey].protocol).toBe("HTTP")
    expect(backendServices[devBackendKey].load_balancing_scheme).toBe("EXTERNAL_MANAGED")
    expect(backendServices[devBackendKey].timeout_sec).toBe(30)
    expect(backendServices[devBackendKey].custom_response_headers).toContain("X-Robots-Tag: noindex, nofollow")
    expect(backendServices[devBackendKey].iap).toBeDefined()
    expect(backendServices[devBackendKey].iap.enabled).toBe(true)
  })

  it("should create prod Backend Service without IAP and with logging", () => {
    const synthesized = Testing.synth(stack)
    const resources = JSON.parse(synthesized).resource
    const backendServices = resources.google_compute_backend_service

    const prodBackendKey = Object.keys(backendServices).find((key) => key.includes("prod-backend"))
    expect(prodBackendKey).toBeDefined()
    expect(backendServices[prodBackendKey].name).toBe("koborin-ai-prod-backend")
    expect(backendServices[prodBackendKey].protocol).toBe("HTTP")
    expect(backendServices[prodBackendKey].load_balancing_scheme).toBe("EXTERNAL_MANAGED")
    expect(backendServices[prodBackendKey].iap).toBeUndefined()
    expect(backendServices[prodBackendKey].log_config).toBeDefined()
    expect(backendServices[prodBackendKey].log_config.enable).toBe(true)
    expect(backendServices[prodBackendKey].log_config.sample_rate).toBe(1.0)
  })

  it("should create IAP IAM binding for dev backend", () => {
    const synthesized = Testing.synth(stack)
    const resources = JSON.parse(synthesized).resource
    const iapBindings = resources.google_iap_web_backend_service_iam_binding

    const devIapKey = Object.keys(iapBindings)[0]
    expect(iapBindings[devIapKey].role).toBe("roles/iap.httpsResourceAccessor")
    expect(iapBindings[devIapKey].members).toBeDefined()
  })

  it("should create Managed SSL Certificate with multi-domain", () => {
    const synthesized = Testing.synth(stack)
    const resources = JSON.parse(synthesized).resource
    const sslCerts = resources.google_compute_managed_ssl_certificate

    const certKey = Object.keys(sslCerts)[0]
    expect(sslCerts[certKey].name).toBe("koborin-ai-cert")
    expect(sslCerts[certKey].managed).toBeDefined()
    expect(sslCerts[certKey].managed.domains).toContain("koborin.ai")
    expect(sslCerts[certKey].managed.domains).toContain("dev.koborin.ai")
  })

  it("should create URL Map with host-based routing", () => {
    const synthesized = Testing.synth(stack)
    const resources = JSON.parse(synthesized).resource
    const urlMaps = resources.google_compute_url_map

    const urlMapKey = Object.keys(urlMaps)[0]
    expect(urlMaps[urlMapKey].name).toBe("koborin-ai-url-map")
    expect(urlMaps[urlMapKey].host_rule).toHaveLength(2)
    expect(urlMaps[urlMapKey].path_matcher).toHaveLength(2)
    
    const hostRules = urlMaps[urlMapKey].host_rule
    const prodRule = hostRules.find((rule: { hosts: string[] }) => rule.hosts.includes("koborin.ai"))
    const devRule = hostRules.find((rule: { hosts: string[] }) => rule.hosts.includes("dev.koborin.ai"))
    
    expect(prodRule).toBeDefined()
    expect(devRule).toBeDefined()
  })

  it("should create Target HTTPS Proxy", () => {
    const synthesized = Testing.synth(stack)
    const resources = JSON.parse(synthesized).resource
    const httpsProxies = resources.google_compute_target_https_proxy

    const proxyKey = Object.keys(httpsProxies)[0]
    expect(httpsProxies[proxyKey].name).toBe("koborin-ai-https-proxy")
  })

  it("should create Global Forwarding Rule with PREMIUM tier", () => {
    const synthesized = Testing.synth(stack)
    const resources = JSON.parse(synthesized).resource
    const forwardingRules = resources.google_compute_global_forwarding_rule

    const ruleKey = Object.keys(forwardingRules)[0]
    expect(forwardingRules[ruleKey].name).toBe("koborin-ai-forwarding-rule")
    expect(forwardingRules[ruleKey].port_range).toBe("443")
    expect(forwardingRules[ruleKey].ip_protocol).toBe("TCP")
    expect(forwardingRules[ruleKey].load_balancing_scheme).toBe("EXTERNAL_MANAGED")
    expect(forwardingRules[ruleKey].network_tier).toBe("PREMIUM")
  })

  it("should configure GCS backend with shared prefix", () => {
    const synthesized = Testing.synth(stack)
    const backend = JSON.parse(synthesized).terraform?.backend?.gcs

    expect(backend).toBeDefined()
    expect(backend.prefix).toBe("shared")
  })

  it("should create Workload Identity Pool for GitHub Actions", () => {
    const synthesized = Testing.synth(stack)
    const resources = JSON.parse(synthesized).resource
    const pools = resources.google_iam_workload_identity_pool

    const poolKey = Object.keys(pools)[0]
    expect(pools[poolKey].workload_identity_pool_id).toBe("github-actions-pool")
    expect(pools[poolKey].display_name).toBe("github-actions-pool")
  })

  it("should create Workload Identity Provider with GitHub OIDC", () => {
    const synthesized = Testing.synth(stack)
    const resources = JSON.parse(synthesized).resource
    const providers = resources.google_iam_workload_identity_pool_provider

    const providerKey = Object.keys(providers)[0]
    expect(providers[providerKey].workload_identity_pool_provider_id).toBe("actions-firebase-provider")
    expect(providers[providerKey].display_name).toBe("github-actions-provider")
    expect(providers[providerKey].attribute_condition).toBe('assertion.repository_owner == "nozomi-koborinai"')
    expect(providers[providerKey].attribute_mapping["google.subject"]).toBe("assertion.repository")
    expect(providers[providerKey].attribute_mapping["attribute.repository_owner"]).toBe("assertion.repository_owner")
    expect(providers[providerKey].oidc.issuer_uri).toBe("https://token.actions.githubusercontent.com")
  })

  it("should create Service Account for GitHub Actions", () => {
    const synthesized = Testing.synth(stack)
    const resources = JSON.parse(synthesized).resource
    const serviceAccounts = resources.google_service_account

    const saKey = Object.keys(serviceAccounts)[0]
    expect(serviceAccounts[saKey].account_id).toBe("github-actions-service")
    expect(serviceAccounts[saKey].display_name).toBe("github-actions-service")
  })

  it("should grant Workload Identity User role to specific repository", () => {
    const synthesized = Testing.synth(stack)
    const resources = JSON.parse(synthesized).resource
    const iamMembers = resources.google_service_account_iam_member

    const wifKey = Object.keys(iamMembers).find((key) => key.includes("github-wif-user"))
    expect(wifKey).toBeDefined()
    expect(iamMembers[wifKey].role).toBe("roles/iam.workloadIdentityUser")
  })

  it("should grant all required project roles to Terraform SA", () => {
    const synthesized = Testing.synth(stack)
    const resources = JSON.parse(synthesized).resource
    const projectIamMembers = resources.google_project_iam_member

    const expectedRoles = [
      "roles/artifactregistry.admin",
      "roles/cloudbuild.builds.builder",
      "roles/run.admin",
      "roles/compute.admin",
      "roles/iap.admin",
      "roles/logging.admin",
      "roles/logging.viewer",
      "roles/monitoring.admin",
      "roles/resourcemanager.projectIamAdmin",
      "roles/iam.serviceAccountUser",
      "roles/iam.serviceAccountAdmin",
      "roles/iam.workloadIdentityPoolAdmin",
      "roles/serviceusage.serviceUsageAdmin",
      "roles/storage.objectAdmin",
    ]

    expectedRoles.forEach((role) => {
      const memberKey = Object.keys(projectIamMembers).find((key) =>
        projectIamMembers[key].role === role
      )
      expect(memberKey).toBeDefined()
      expect(projectIamMembers[memberKey].role).toBe(role)
    })
  })

  it("should enable Certificate Manager API", () => {
    const synthesized = Testing.synth(stack)
    const resources = JSON.parse(synthesized).resource
    const projectServices = resources.google_project_service

    const certManagerKey = Object.keys(projectServices).find((key) =>
      projectServices[key].service === "certificatemanager.googleapis.com"
    )
    expect(certManagerKey).toBeDefined()
  })

  // DNS is managed in Cloudflare outside of Terraform.
})
