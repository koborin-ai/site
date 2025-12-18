import * as gcp from "@pulumi/gcp"
import { getEnvironmentStackConfig } from "../config"

const config = getEnvironmentStackConfig()

/**
 * ProdStack creates Cloud Run service for the production environment.
 * The service is referenced by the Serverless NEG created in shared stack.
 */

// Cloud Run V2 Service for prod
const webProd = new gcp.cloudrunv2.Service(
  "web-prod",
  {
    project: config.projectId,
    location: "asia-northeast1",
    name: "koborin-ai-web-prod",
    ingress: "INGRESS_TRAFFIC_INTERNAL_LOAD_BALANCER",
    template: {
      executionEnvironment: "EXECUTION_ENVIRONMENT_GEN2",
      containers: [
        {
          image: config.imageUri,
          envs: [
            // NODE_ENV: server-side environment detection
            { name: "NODE_ENV", value: "production" },
            // NEXT_PUBLIC_ENV: client-side environment detection (legacy, kept for compatibility)
            { name: "NEXT_PUBLIC_ENV", value: "prod" },
          ],
        },
      ],
      scaling: {
        minInstanceCount: 0,
        maxInstanceCount: 10,
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
    import: `projects/${config.projectId}/locations/asia-northeast1/services/koborin-ai-web-prod`,
  }
)

// Grant public access to prod Cloud Run service
const _webProdInvoker = new gcp.cloudrunv2.ServiceIamMember(
  "web-prod-invoker",
  {
    project: config.projectId,
    location: "asia-northeast1",
    name: webProd.name,
    role: "roles/run.invoker",
    member: "allUsers",
  },
  {
    // Import existing IAM binding from CDKTF state
    import: `projects/${config.projectId}/locations/asia-northeast1/services/koborin-ai-web-prod/roles/run.invoker/allUsers`,
  }
)

// ========================================
// Exports
// ========================================

export const serviceId = webProd.id
export const serviceName = webProd.name
export const serviceUri = webProd.uri
