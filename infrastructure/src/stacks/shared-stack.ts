import { ArtifactRegistryRepository } from "@cdktf/provider-google/lib/artifact-registry-repository"
import { ComputeBackendService } from "@cdktf/provider-google/lib/compute-backend-service"
import { ComputeGlobalAddress } from "@cdktf/provider-google/lib/compute-global-address"
import { ComputeGlobalForwardingRule } from "@cdktf/provider-google/lib/compute-global-forwarding-rule"
import { ComputeManagedSslCertificate } from "@cdktf/provider-google/lib/compute-managed-ssl-certificate"
import { ComputeRegionNetworkEndpointGroup } from "@cdktf/provider-google/lib/compute-region-network-endpoint-group"
import { ComputeTargetHttpsProxy } from "@cdktf/provider-google/lib/compute-target-https-proxy"
import { ComputeUrlMap } from "@cdktf/provider-google/lib/compute-url-map"
import { IamWorkloadIdentityPool } from "@cdktf/provider-google/lib/iam-workload-identity-pool"
import { IamWorkloadIdentityPoolProvider } from "@cdktf/provider-google/lib/iam-workload-identity-pool-provider"
import { IapWebBackendServiceIamBinding } from "@cdktf/provider-google/lib/iap-web-backend-service-iam-binding"
import { ProjectIamMember } from "@cdktf/provider-google/lib/project-iam-member"
import { ProjectService } from "@cdktf/provider-google/lib/project-service"
import { GoogleProvider } from "@cdktf/provider-google/lib/provider"
import { ServiceAccount } from "@cdktf/provider-google/lib/service-account"
import { ServiceAccountIamMember } from "@cdktf/provider-google/lib/service-account-iam-member"
import { TerraformStack } from "cdktf"
import { GcsBackend } from "cdktf/lib/backends/gcs-backend"
import { Construct } from "constructs"
import { createSharedStackConfig } from "../config/stack-config"

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

/**
 * SharedStack manages resources shared across dev/prod environments:
 * - API enablement
 * - Artifact Registry for container images
 * - Global static IP for HTTPS load balancer
 * - Serverless NEG (dev/prod) pointing to Cloud Run services
 * - Backend Service (dev with IAP, prod without IAP)
 * - Managed SSL Certificate (multi-domain)
 * - URL Map (host-based routing)
 * - Target HTTPS Proxy
 * - Global Forwarding Rule
 *
 * Additional resources handled outside Terraform:
 * - DNS hosted in Cloudflare (A records managed manually)
 */
export class SharedStack extends TerraformStack {
  constructor(scope: Construct, id: string) {
    super(scope, id)

    const config = createSharedStackConfig(this)

    // GCS backend for shared state
    new GcsBackend(this, {
      bucket: config.stateBucket,
      prefix: "shared",
    })

    // Google Provider
    new GoogleProvider(this, "google-shared", {
      project: config.projectId,
      region: "asia-northeast1",
    })

    // Enable required APIs
    const apiServices: ProjectService[] = []
    REQUIRED_APIS.forEach((api) => {
      const apiService = new ProjectService(this, `api-${api.replace(/\./g, "-")}`, {
        project: config.projectId,
        service: api,
        disableDependentServices: false,
        disableOnDestroy: false,
      })
      apiServices.push(apiService)
    })

    // Artifact Registry for Next.js container images
    new ArtifactRegistryRepository(this, "artifact-registry", {
      project: config.projectId,
      location: "asia-northeast1",
      repositoryId: "koborin-ai-web",
      description: "Container images for koborin.ai web application (dev/prod)",
      format: "DOCKER",
      dockerConfig: {
        immutableTags: true,
      },
      dependsOn: apiServices,
    })

    // Global static IP for HTTPS load balancer
    const staticIp = new ComputeGlobalAddress(this, "global-ip", {
      project: config.projectId,
      name: "koborin-ai-global-ip",
      addressType: "EXTERNAL",
      ipVersion: "IPV4",
      description: "Static IP for koborin.ai HTTPS load balancer",
      dependsOn: apiServices,
    })

    // ========================================
    // Dev Environment Backend
    // ========================================

    // Serverless NEG for dev Cloud Run
    const devNeg = new ComputeRegionNetworkEndpointGroup(this, "dev-neg", {
      project: config.projectId,
      region: "asia-northeast1",
      name: "koborin-ai-dev-neg",
      networkEndpointType: "SERVERLESS",
      cloudRun: {
        service: "koborin-ai-web-dev",
      },
      lifecycle: {
        createBeforeDestroy: true,
      },
      dependsOn: apiServices,
    })

    // Backend Service for dev (with IAP)
    const devBackend = new ComputeBackendService(this, "dev-backend", {
      project: config.projectId,
      name: "koborin-ai-dev-backend",
      protocol: "HTTP",
      loadBalancingScheme: "EXTERNAL_MANAGED",
      timeoutSec: 30,
      customResponseHeaders: ["X-Robots-Tag: noindex, nofollow"],
      backend: [
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
      lifecycle: {
        createBeforeDestroy: true,
      },
      dependsOn: [devNeg],
    })

    // IAP access control for dev
    new IapWebBackendServiceIamBinding(this, "dev-iap-access", {
      project: config.projectId,
      webBackendService: devBackend.name,
      role: "roles/iap.httpsResourceAccessor",
      members: [`user:${config.iapUser}`],
      dependsOn: [devBackend],
    })

    // ========================================
    // Prod Environment Backend
    // ========================================

    // Serverless NEG for prod Cloud Run
    const prodNeg = new ComputeRegionNetworkEndpointGroup(this, "prod-neg", {
      project: config.projectId,
      region: "asia-northeast1",
      name: "koborin-ai-prod-neg",
      networkEndpointType: "SERVERLESS",
      cloudRun: {
        service: "koborin-ai-web-prod",
      },
      lifecycle: {
        createBeforeDestroy: true,
      },
      dependsOn: apiServices,
    })

    // Backend Service for prod (no IAP)
    const prodBackend = new ComputeBackendService(this, "prod-backend", {
      project: config.projectId,
      name: "koborin-ai-prod-backend",
      protocol: "HTTP",
      loadBalancingScheme: "EXTERNAL_MANAGED",
      timeoutSec: 30,
      backend: [
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
      lifecycle: {
        createBeforeDestroy: true,
      },
      dependsOn: [prodNeg],
    })

    // ========================================
    // HTTPS Load Balancer
    // ========================================

    // Managed SSL Certificate (multi-domain)
    const sslCert = new ComputeManagedSslCertificate(this, "managed-cert", {
      project: config.projectId,
      name: "koborin-ai-cert",
      managed: {
        domains: ["koborin.ai", "dev.koborin.ai"],
      },
      lifecycle: {
        createBeforeDestroy: true,
      },
      dependsOn: apiServices,
    })

    // URL Map (host-based routing)
    const urlMap = new ComputeUrlMap(this, "url-map", {
      project: config.projectId,
      name: "koborin-ai-url-map",
      description: "Routes traffic to dev/prod backends based on host header",
      defaultService: prodBackend.id,
      hostRule: [
        { hosts: ["koborin.ai"], pathMatcher: "prod-matcher" },
        { hosts: ["dev.koborin.ai"], pathMatcher: "dev-matcher" },
      ],
      pathMatcher: [
        { name: "prod-matcher", defaultService: prodBackend.id },
        { name: "dev-matcher", defaultService: devBackend.id },
      ],
      lifecycle: {
        createBeforeDestroy: true,
      },
      dependsOn: [devBackend, prodBackend],
    })

    // Target HTTPS Proxy
    const httpsProxy = new ComputeTargetHttpsProxy(this, "https-proxy", {
      project: config.projectId,
      name: "koborin-ai-https-proxy",
      urlMap: urlMap.id,
      sslCertificates: [sslCert.id],
      lifecycle: {
        createBeforeDestroy: true,
      },
      dependsOn: [urlMap, sslCert],
    })

    // Global Forwarding Rule
    new ComputeGlobalForwardingRule(this, "forwarding-rule", {
      project: config.projectId,
      name: "koborin-ai-forwarding-rule",
      target: httpsProxy.id,
      portRange: "443",
      ipProtocol: "TCP",
      loadBalancingScheme: "EXTERNAL_MANAGED",
      networkTier: "PREMIUM",
      ipAddress: staticIp.address,
      dependsOn: [httpsProxy, staticIp],
    })

    // ========================================
    // Workload Identity (for GitHub Actions)
    // ========================================
    // Security Note: While pool/provider IDs and project numbers are hardcoded here,
    // this configuration is secure due to multi-layered protection:
    // 1. attributeCondition restricts access to repository_owner "nozomi-koborinai" only
    // 2. IAM binding grants impersonation only to specific subject (nozomi-koborinai/koborin-ai)
    // 3. GitHub issues OIDC tokens that must match these conditions
    // Even if someone discovers these IDs, they cannot authenticate without:
    // - Owning the nozomi-koborinai GitHub account
    // - Running workflows from the koborin-ai repository
    // This follows Google's Workload Identity Federation design where IDs are public-safe.

    // Workload Identity Pool
    const workloadIdentityPool = new IamWorkloadIdentityPool(this, "github-actions-pool", {
      project: config.projectId,
      workloadIdentityPoolId: "github-actions-pool",
      displayName: "github-actions-pool",
      description: "Workload Identity Pool for GitHub Actions workflows",
    })

    // Workload Identity Provider (GitHub OIDC)
    new IamWorkloadIdentityPoolProvider(this, "github-provider", {
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
    })

    // Service Account for Terraform deployment
    const terraformSa = new ServiceAccount(this, "github-actions-sa", {
      project: config.projectId,
      accountId: "github-actions-service",
      displayName: "github-actions-service",
      description: "Service account for GitHub Actions to deploy via Terraform",
    })

    // Allow Workload Identity Pool to impersonate the service account
    // Uses subject-based binding to restrict access to this specific repository only
    // (nozomi-koborinai/koborin-ai). This is more restrictive than attribute-based
    // principalSet binding which would allow all repos owned by nozomi-koborinai.
    new ServiceAccountIamMember(this, "github-wif-user", {
      serviceAccountId: terraformSa.name,
      role: "roles/iam.workloadIdentityUser",
      member: `principal://iam.googleapis.com/projects/${config.projectNumber}/locations/global/workloadIdentityPools/${workloadIdentityPool.workloadIdentityPoolId}/subject/nozomi-koborinai/koborin-ai`,
    })

    // Grant necessary roles to the Terraform deployer service account
    const terraformRoles = [
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

    terraformRoles.forEach((role) => {
      new ProjectIamMember(this, `terraform-sa-${role.replace(/\./g, "-").replace(/\//g, "-")}`, {
        project: config.projectId,
        role: role,
        member: `serviceAccount:${terraformSa.email}`,
      })
    })

  }
}
