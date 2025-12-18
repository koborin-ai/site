import * as gcp from "@pulumi/gcp"
import * as pulumi from "@pulumi/pulumi"
import { getSharedStackConfig } from "../config"

const config = getSharedStackConfig()

// Service account email is deterministic based on accountId and projectId
const githubActionsSaEmail = `github-actions-service@${config.projectId}.iam.gserviceaccount.com`

/**
 * APIs required for Cloud Run, Artifact Registry, Load Balancing, and IAM.
 */
const REQUIRED_APIS = [
  "run.googleapis.com",
  "compute.googleapis.com",
  "iam.googleapis.com",
  "cloudresourcemanager.googleapis.com",
  "artifactregistry.googleapis.com",
  "cloudbuild.googleapis.com",
  "iap.googleapis.com",
  "monitoring.googleapis.com",
  "logging.googleapis.com",
  "certificatemanager.googleapis.com",
]

// ========================================
// Enable Required APIs
// ========================================

const apiServices = REQUIRED_APIS.map(
  (api) =>
    new gcp.projects.Service(
      `api-${api.replace(/\./g, "-")}`,
      {
        project: config.projectId,
        service: api,
        disableDependentServices: false,
        disableOnDestroy: false,
      },
      {
        // Import existing API service from CDKTF state
        import: `${config.projectId}/${api}`,
      }
    )
)

// ========================================
// Artifact Registry
// ========================================

const artifactRegistry = new gcp.artifactregistry.Repository(
  "artifact-registry",
  {
    project: config.projectId,
    location: "asia-northeast1",
    repositoryId: "koborin-ai-web",
    description: "Container images for koborin.ai web application (dev/prod)",
    format: "DOCKER",
    dockerConfig: {
      immutableTags: true,
    },
  },
  {
    dependsOn: apiServices,
    // Import existing Artifact Registry from CDKTF state
    import: `projects/${config.projectId}/locations/asia-northeast1/repositories/koborin-ai-web`,
  }
)

// ========================================
// Global Static IP
// ========================================

const staticIp = new gcp.compute.GlobalAddress(
  "global-ip",
  {
    project: config.projectId,
    name: "koborin-ai-global-ip",
    addressType: "EXTERNAL",
    ipVersion: "IPV4",
    description: "Static IP for koborin.ai HTTPS load balancer",
  },
  {
    dependsOn: apiServices,
    // Import existing Global Address from CDKTF state
    import: `projects/${config.projectId}/global/addresses/koborin-ai-global-ip`,
  }
)

// ========================================
// Dev Environment Backend
// ========================================

// Serverless NEG for dev Cloud Run
const devNeg = new gcp.compute.RegionNetworkEndpointGroup(
  "dev-neg",
  {
    project: config.projectId,
    region: "asia-northeast1",
    name: "koborin-ai-dev-neg",
    networkEndpointType: "SERVERLESS",
    cloudRun: {
      service: "koborin-ai-web-dev",
    },
  },
  {
    dependsOn: apiServices,
    // Import existing NEG from CDKTF state
    import: `projects/${config.projectId}/regions/asia-northeast1/networkEndpointGroups/koborin-ai-dev-neg`,
  }
)

// Backend Service for dev (with IAP)
const devBackend = new gcp.compute.BackendService(
  "dev-backend",
  {
    project: config.projectId,
    name: "koborin-ai-dev-backend",
    protocol: "HTTP",
    loadBalancingScheme: "EXTERNAL_MANAGED",
    timeoutSec: 30,
    customResponseHeaders: ["X-Robots-Tag: noindex, nofollow"],
    backends: [
      {
        group: devNeg.id,
        balancingMode: "UTILIZATION",
        capacityScaler: 1.0,
      },
    ],
    iap: {
      enabled: true,
      oauth2ClientId: config.oauthClientId,
      oauth2ClientSecret: config.oauthClientSecret,
    },
  },
  {
    dependsOn: [devNeg],
    // Import existing Backend Service from CDKTF state
    import: `projects/${config.projectId}/global/backendServices/koborin-ai-dev-backend`,
  }
)

// IAP access control for dev
const _devIapAccess = new gcp.iap.WebBackendServiceIamBinding(
  "dev-iap-access",
  {
    project: config.projectId,
    webBackendService: devBackend.name,
    role: "roles/iap.httpsResourceAccessor",
    members: [`user:${config.iapUser}`],
  },
  {
    dependsOn: [devBackend],
    // Import existing IAP binding from CDKTF state
    // Format: projects/{project}/iap_web/compute/services/{web_backend_service}
    import: `projects/${config.projectId}/iap_web/compute/services/koborin-ai-dev-backend`,
  }
)

// ========================================
// Prod Environment Backend
// ========================================

// Serverless NEG for prod Cloud Run
const prodNeg = new gcp.compute.RegionNetworkEndpointGroup(
  "prod-neg",
  {
    project: config.projectId,
    region: "asia-northeast1",
    name: "koborin-ai-prod-neg",
    networkEndpointType: "SERVERLESS",
    cloudRun: {
      service: "koborin-ai-web-prod",
    },
  },
  {
    dependsOn: apiServices,
    // Import existing NEG from CDKTF state
    import: `projects/${config.projectId}/regions/asia-northeast1/networkEndpointGroups/koborin-ai-prod-neg`,
  }
)

// Backend Service for prod (no IAP)
const prodBackend = new gcp.compute.BackendService(
  "prod-backend",
  {
    project: config.projectId,
    name: "koborin-ai-prod-backend",
    protocol: "HTTP",
    loadBalancingScheme: "EXTERNAL_MANAGED",
    timeoutSec: 30,
    backends: [
      {
        group: prodNeg.id,
        balancingMode: "UTILIZATION",
        capacityScaler: 1.0,
      },
    ],
    logConfig: {
      enable: true,
      sampleRate: 1.0,
    },
  },
  {
    dependsOn: [prodNeg],
    // Import existing Backend Service from CDKTF state
    import: `projects/${config.projectId}/global/backendServices/koborin-ai-prod-backend`,
  }
)

// ========================================
// HTTPS Load Balancer
// ========================================

// Managed SSL Certificate (multi-domain)
const sslCert = new gcp.compute.ManagedSslCertificate(
  "managed-cert",
  {
    project: config.projectId,
    name: "koborin-ai-cert",
    managed: {
      domains: ["koborin.ai", "dev.koborin.ai"],
    },
  },
  {
    dependsOn: apiServices,
    // Import existing SSL certificate from CDKTF state
    import: `projects/${config.projectId}/global/sslCertificates/koborin-ai-cert`,
  }
)

// URL Map (host-based routing)
const urlMap = new gcp.compute.URLMap(
  "url-map",
  {
    project: config.projectId,
    name: "koborin-ai-url-map",
    description: "Routes traffic to dev/prod backends based on host header",
    defaultService: prodBackend.id,
    hostRules: [
      { hosts: ["koborin.ai"], pathMatcher: "prod-matcher" },
      { hosts: ["dev.koborin.ai"], pathMatcher: "dev-matcher" },
    ],
    pathMatchers: [
      { name: "prod-matcher", defaultService: prodBackend.id },
      { name: "dev-matcher", defaultService: devBackend.id },
    ],
  },
  {
    dependsOn: [devBackend, prodBackend],
    // Import existing URL Map from CDKTF state
    import: `projects/${config.projectId}/global/urlMaps/koborin-ai-url-map`,
  }
)

// Target HTTPS Proxy
const httpsProxy = new gcp.compute.TargetHttpsProxy(
  "https-proxy",
  {
    project: config.projectId,
    name: "koborin-ai-https-proxy",
    urlMap: urlMap.id,
    sslCertificates: [sslCert.id],
  },
  {
    dependsOn: [urlMap, sslCert],
    // Import existing HTTPS proxy from CDKTF state
    import: `projects/${config.projectId}/global/targetHttpsProxies/koborin-ai-https-proxy`,
  }
)

// Global Forwarding Rule
const forwardingRule = new gcp.compute.GlobalForwardingRule(
  "forwarding-rule",
  {
    project: config.projectId,
    name: "koborin-ai-forwarding-rule",
    target: httpsProxy.id,
    portRange: "443",
    ipProtocol: "TCP",
    loadBalancingScheme: "EXTERNAL_MANAGED",
    networkTier: "PREMIUM",
    ipAddress: staticIp.address,
  },
  {
    dependsOn: [httpsProxy, staticIp],
    // Import existing Forwarding Rule from CDKTF state
    import: `projects/${config.projectId}/global/forwardingRules/koborin-ai-forwarding-rule`,
  }
)

// ========================================
// Workload Identity (for GitHub Actions)
// ========================================

// Workload Identity Pool
const workloadIdentityPool = new gcp.iam.WorkloadIdentityPool(
  "github-actions-pool",
  {
    project: config.projectId,
    workloadIdentityPoolId: "github-actions-pool",
    displayName: "github-actions-pool",
    description: "Workload Identity Pool for GitHub Actions workflows",
  },
  {
    // Import existing Workload Identity Pool from CDKTF state
    import: `projects/${config.projectId}/locations/global/workloadIdentityPools/github-actions-pool`,
  }
)

// Workload Identity Provider (GitHub OIDC)
const workloadIdentityProvider = new gcp.iam.WorkloadIdentityPoolProvider(
  "github-provider",
  {
    project: config.projectId,
    workloadIdentityPoolId: workloadIdentityPool.workloadIdentityPoolId,
    workloadIdentityPoolProviderId: "actions-firebase-provider",
    displayName: "github-actions-provider",
    description: "GitHub Actions OIDC provider",
    // Only allow workflows from repositories owned by nozomi-koborinai
    attributeCondition: 'assertion.repository_owner == "nozomi-koborinai"',
    attributeMapping: {
      "google.subject": "assertion.repository",
      "attribute.repository_owner": "assertion.repository_owner",
    },
    oidc: {
      issuerUri: "https://token.actions.githubusercontent.com",
    },
  },
  {
    // Import existing Workload Identity Provider from CDKTF state
    import: `projects/${config.projectId}/locations/global/workloadIdentityPools/github-actions-pool/providers/actions-firebase-provider`,
  }
)

// Service Account for Terraform deployment
const githubActionsSa = new gcp.serviceaccount.Account(
  "github-actions-sa",
  {
    project: config.projectId,
    accountId: "github-actions-service",
    displayName: "github-actions-service",
    description: "Service account for GitHub Actions to deploy via Terraform",
  },
  {
    // Import existing Service Account from CDKTF state
    import: `projects/${config.projectId}/serviceAccounts/${githubActionsSaEmail}`,
  }
)

// Allow Workload Identity Pool to impersonate the service account
const _githubWifUser = new gcp.serviceaccount.IAMMember(
  "github-wif-user",
  {
    serviceAccountId: githubActionsSa.name,
    role: "roles/iam.workloadIdentityUser",
    member: pulumi.interpolate`principal://iam.googleapis.com/projects/${config.projectNumber}/locations/global/workloadIdentityPools/${workloadIdentityPool.workloadIdentityPoolId}/subject/nozomi-koborinai/koborin-ai`,
  },
  {
    // Import existing IAM binding from CDKTF state
    import: `projects/${config.projectId}/serviceAccounts/${githubActionsSaEmail} roles/iam.workloadIdentityUser principal://iam.googleapis.com/projects/${config.projectNumber}/locations/global/workloadIdentityPools/github-actions-pool/subject/nozomi-koborinai/koborin-ai`,
  }
)

// Grant necessary roles to the deployer service account
const DEPLOYER_ROLES = [
  "roles/artifactregistry.admin",
  "roles/cloudbuild.builds.builder",
  "roles/cloudbuild.builds.viewer",
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

const _deployerRoleBindings = DEPLOYER_ROLES.map(
  (role) =>
    new gcp.projects.IAMMember(
      `deployer-sa-${role.replace(/\./g, "-").replace(/\//g, "-")}`,
      {
        project: config.projectId,
        role: role,
        member: pulumi.interpolate`serviceAccount:${githubActionsSa.email}`,
      },
      {
        // Import existing IAM binding from CDKTF state
        import: `${config.projectId} ${role} serviceAccount:${githubActionsSaEmail}`,
      }
    )
)

// ========================================
// Exports
// ========================================

export const artifactRegistryId = artifactRegistry.id
export const staticIpAddress = staticIp.address
export const devBackendId = devBackend.id
export const prodBackendId = prodBackend.id
export const urlMapId = urlMap.id
export const httpsProxyId = httpsProxy.id
export const forwardingRuleId = forwardingRule.id
export const workloadIdentityPoolId = workloadIdentityPool.workloadIdentityPoolId
export const workloadIdentityProviderId = workloadIdentityProvider.workloadIdentityPoolProviderId
export const githubActionsServiceAccountEmail = githubActionsSa.email
