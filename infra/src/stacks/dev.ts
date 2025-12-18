import * as gcp from "@pulumi/gcp"
import * as pulumi from "@pulumi/pulumi"
import { getEnvironmentStackConfig } from "../config"

const config = getEnvironmentStackConfig()

/**
 * DevStack creates Cloud Run service for the development environment.
 * The service is referenced by the Serverless NEG created in shared stack.
 */

// Cloud Run V2 Service for dev
const webDev = new gcp.cloudrunv2.Service(
  "web-dev",
  {
    project: config.projectId,
    location: "asia-northeast1",
    name: "koborin-ai-web-dev",
    ingress: "INGRESS_TRAFFIC_INTERNAL_LOAD_BALANCER",
    template: {
      executionEnvironment: "EXECUTION_ENVIRONMENT_GEN2",
      containers: [
        {
          image: config.imageUri,
          envs: [
            // NODE_ENV: server-side environment detection
            { name: "NODE_ENV", value: "development" },
            // NEXT_PUBLIC_ENV: client-side environment detection (legacy, kept for compatibility)
            { name: "NEXT_PUBLIC_ENV", value: "dev" },
          ],
        },
      ],
      scaling: {
        minInstanceCount: 0,
        maxInstanceCount: 1,
      },
    },
    traffics: [
      {
        type: "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST",
        percent: 100,
      },
    ],
  },
  {
    // Import existing Cloud Run service from CDKTF state
    import: `projects/${config.projectId}/locations/asia-northeast1/services/koborin-ai-web-dev`,
  }
)

// Grant Cloud Run Invoker role to IAP Service Agent
// IAP uses this service account to invoke the Cloud Run service after authentication
const _webDevIapInvoker = new gcp.cloudrunv2.ServiceIamMember(
  "web-dev-iap-invoker",
  {
    project: config.projectId,
    location: "asia-northeast1",
    name: webDev.name,
    role: "roles/run.invoker",
    member: pulumi.interpolate`serviceAccount:service-${config.projectNumber}@gcp-sa-iap.iam.gserviceaccount.com`,
  }
  // Note: This resource is new (not imported from CDKTF) - IAP Service Agent needs
  // Cloud Run Invoker role to forward authenticated requests to the service
)

// ========================================
// Exports
// ========================================

export const serviceId = webDev.id
export const serviceName = webDev.name
export const serviceUri = webDev.uri
