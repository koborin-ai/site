# koborin.ai

Personal website + engineering playground for `koborin.ai`.  
The repository hosts both the Astro-powered application (MDX-first) and the Google Cloud infrastructure (managed via CDK for Terraform 0.21.x).

## Project Goals

- Deliver a fast personal site with MDX-based content (Astro Content Collections), deployable to Cloud Run (dev/prod) via a shared HTTPS load balancer.
- Keep every change (infra + app) under version control and shipped only through GitHub Actions using Workload Identity Federation.
- Maintain o11y: Cloud Logging/Monitoring/Trace, structured logging, PV tracking, and a secure contact flow.

## Architecture Snapshot

```mermaid
---
title: "Google Cloud Project"
---
flowchart LR
    subgraph TF_STATE["TF Backend State - GCS"]
        STATE_SHARED["shared"]
        STATE_DEV["dev"]
        STATE_PROD["prod"]
    end
    
    subgraph SHARED["Shared Resources"]
        APIS["APIs"]
        ARTIFACT["Artifact Registry"]
        WIF["Workload Identity<br/>Pool/Provider"]
    end
    
    subgraph DNS["Cloudflare DNS (manual)"]
        DEV_DOMAIN["dev.koborin.ai<br/>A record"]
        PROD_DOMAIN["koborin.ai<br/>A record"]
    end
    
    subgraph LB["Unified HTTPS LB - shared"]
        STATIC_IP["Static IP<br/>PREMIUM tier"]
        SSL_CERT["Managed SSL Cert<br/>multi-domain"]
        URL_MAP["URL Map<br/>host routing"]
        HTTPS_PROXY["HTTPS Proxy"]
    end
    
    subgraph DEV_BACKEND["Dev Backend"]
        DEV_IAP["IAP<br/>+ X-Robots-Tag"]
        DEV_NEG["Serverless NEG"]
        DEV_CR["Cloud Run<br/>koborin-ai-web-dev (Astro)<br/>(LB-only ingress)"]
    end
    
    subgraph PROD_BACKEND["Prod Backend"]
        PROD_NEG["Serverless NEG"]
        PROD_CR["Cloud Run<br/>koborin-ai-web-prod (Astro)<br/>(LB-only ingress)"]
    end
    
    subgraph CICD["GitHub Actions"]
        GH_WIF["Workload Identity<br/>Federation"]
        TF_SA["Terraform SA"]
    end
    
    STATE_SHARED -.-> SHARED
    STATE_SHARED -.-> LB
    STATE_DEV -.-> DEV_BACKEND
    STATE_PROD -.-> PROD_BACKEND
    
    ARTIFACT -.->|"Container Image"| DEV_CR
    ARTIFACT -.->|"Container Image"| PROD_CR
    
    DEV_DOMAIN --> STATIC_IP
    PROD_DOMAIN --> STATIC_IP
    STATIC_IP --> SSL_CERT
    SSL_CERT --> HTTPS_PROXY
    HTTPS_PROXY --> URL_MAP
    
    URL_MAP -->|"dev host"| DEV_IAP
    URL_MAP -->|"prod host"| PROD_NEG
    
    DEV_IAP --> DEV_NEG
    DEV_NEG --> DEV_CR
    PROD_NEG --> PROD_CR
    
    GH_WIF -.->|"Authenticate"| WIF
    WIF -.->|"Impersonate"| TF_SA
    TF_SA -.->|"Plan/Apply"| TF_STATE
    
    style TF_STATE fill:#E8E8E8,color:#000,stroke:#666,stroke-width:2px
    style STATE_SHARED fill:#F5F5F5,color:#000
    style STATE_DEV fill:#F5F5F5,color:#000
    style STATE_PROD fill:#F5F5F5,color:#000
    style APIS fill:#9E9E9E,color:#fff
    style ARTIFACT fill:#9E9E9E,color:#fff
    style WIF fill:#9E9E9E,color:#fff
    style STATIC_IP fill:#00B6AC,color:#fff
    style SSL_CERT fill:#00B6AC,color:#fff
    style URL_MAP fill:#00B6AC,color:#fff
    style HTTPS_PROXY fill:#00B6AC,color:#fff
    style DEV_IAP fill:#F76560,color:#fff
    style DEV_CR fill:#4A90E2,color:#fff
    style PROD_CR fill:#4A90E2,color:#fff
    style GH_WIF fill:#FFB74D,color:#000
    style TF_SA fill:#FFB74D,color:#000
```

> DNS is hosted in Cloudflare. Terraform does **not** manage DNS records; add/update `koborin.ai` / `dev.koborin.ai` A records manually whenever the load balancer IP changes.

**Key Differences by Environment:**

| Layer | Dev (`dev.koborin.ai`) | Prod (`koborin.ai`) |
| --- | --- | --- |
| Runtime | Cloud Run (`koborin-ai-web-dev`) | Cloud Run (`koborin-ai-web-prod`) |
| Access | IAP allow list + `X-Robots-Tag: noindex` | Public (no IAP) |
| Ingress | `INGRESS_TRAFFIC_INTERNAL_LOAD_BALANCER` | `INGRESS_TRAFFIC_INTERNAL_LOAD_BALANCER` |
| Scaling | Min: 0, Max: 1 | Min: 0, Max: 10 |
| Env Vars | `NODE_ENV=development`, `NEXT_PUBLIC_ENV=dev` | `NODE_ENV=production`, `NEXT_PUBLIC_ENV=prod` |
| Content | Same MDX content (no env-specific filtering) | Same MDX content (no env-specific filtering) |
| Analytics | GA4 (debug view) + optional server events | GA4 + server events + Cloud Monitoring |

## Tech Stack

- **Frontend**: Astro (Content Collections + MDX), TypeScript, Tailwind CSS.
- **Content Management**: Markdown/MDX stored under `content/` within git. Frontmatter is validated via Zod schemas to keep metadata type-safe. Drafts reside in `content/drafts` and are excluded from prod builds by default.
- **Analytics & o11y**:
  - Google Analytics 4 for baseline PV/engagement.
  - Optional custom `/api/track` endpoint writing to Cloud Logging → BigQuery for privacy-friendly metrics.
  - Cloud Monitoring dashboards + alert policies (via Terraform) for Cloud Run metrics.
- **Infrastructure**: CDK for Terraform 0.21.x (TypeScript) targeting Google Cloud.
- **CI/CD**: GitHub Actions with Workload Identity. `plan-infra.yml` / `release-infra.yml` drive infra, `app-ci.yml` / `app-release.yml` handle the Astro app.
- **Testing**: Vite + Vitest (shared config across app and infra), Playwright for future E2E if needed.

## Repository Layout (planned)

```text
.
├── app/                    # Astro application (to be created)
├── content/                # MDX articles/pages, versioned with git
├── docs/                   # Architecture notes, contact-flow specs, etc.
├── infrastructure/         # CDKTF project (shared/dev/prod stacks)
├── .github/workflows/      # CI pipelines (plan/apply, app deploy)
├── README.md               # This file
└── AGENTS.md               # English operations guide for collaborators
```

## Workflow Overview

1. **Infra changes**: edit CDKTF stacks → `npm run test:infra` → open PR → GitHub Actions runs synth/plan → reviewer approves → merge triggers apply on the right environment.
2. **App changes**: edit Astro/MDX → `npm run lint && npm run test && npm run typecheck && npm run build` → PR triggers `app-ci.yml` → merge to `main` (or tag `app-v*`) triggers `app-release.yml` which builds the container, pushes to Artifact Registry, and feeds the new image to CDKTF.
3. **Content-only updates**: modify MDX, include frontmatter (`title`, `slug`, `published`, etc.), run `npm run content:lint`, open PR. Draft pieces stay under `content/drafts`.

## Release Strategy

- Infra applies use `infra-v*` tags to trigger `release-infra.yml`. Tag the repo after merging infra PRs even if app work is still ongoing; this ensures the latest load balancer/stateful resources are deployed before app images roll out.
- App deploys use `app-v*` tags to drive `app-release.yml`. Tagging after a successful `main` merge guarantees that the latest container image is built and the Cloud Run service is updated via CDKTF.
- GitHub release notes are generated via `.github/release.yml`. Label each PR with `app`, `infra`, `terraform`, `feature`, `bug`, or `doc` so the notes stay segmented by domain; apply the `ignore` label to omit a PR entirely.

## Local Setup (once the app repo is initialized)

```bash
# Node.js >= 20, npm 10 recommended
npm install

# Run Astro dev server (app directory)
npm run dev --prefix app

# Run infrastructure unit tests
npm run test:infra --prefix infrastructure
```

## Infrastructure Dev Notes

- CDKTF `cdktf.json` uses `node lib/main.js` and pins `google` / `google-beta` providers to `~> 6.50`.
- Each stack configures `GcsBackend` with the same bucket but different prefixes (`shared`, `dev`, `prod`).

### Shared Stack (✅ Implemented)

- **API enablement**: Run, Compute, IAM, Artifact Registry, IAP, Monitoring, Logging, Certificate Manager.
- **Artifact Registry**: Container images repository (`koborin-ai-web`).
- **Global static IP**: PREMIUM tier for HTTPS load balancer.
- **Managed SSL Certificate**: Multi-domain (`koborin.ai`, `dev.koborin.ai`).
- **HTTPS Load Balancer**:
  - Serverless NEGs (dev/prod) referencing Cloud Run services by name.
  - Backend Services:
    - Dev: IAP enabled + `X-Robots-Tag: noindex, nofollow` header.
    - Prod: No IAP, logging enabled.
  - URL Map (host-based routing).
  - Target HTTPS Proxy.
  - Global Forwarding Rule.
- **Workload Identity Federation**:
  - Pool: `github-actions-pool`.
  - Provider: `actions-firebase-provider` (OIDC issuer: `https://token.actions.githubusercontent.com`).
  - Service Account: `github-actions-service@{project}.iam.gserviceaccount.com`.
  - IAM binding: Subject-based binding for repository `nozomi-koborinai/koborin-ai`.
  - Project IAM roles (Artifact Registry, Run, Compute, IAM, etc.) granted to the Terraform SA.
- **DNS**: Records live in Cloudflare and are managed manually (A records point to the LB IP).

### Dev Stack (✅ Implemented)

- **Cloud Run Service**: `koborin-ai-web-dev`.
  - Ingress: `INGRESS_TRAFFIC_INTERNAL_LOAD_BALANCER` (LB-only access).
  - Execution Environment: Gen2.
  - Environment Variables:
    - `NODE_ENV=development` (runtime mode).
    - `NEXT_PUBLIC_ENV=dev` (client-side environment identifier).
  - Scaling: Min 0, Max 1.

### Prod Stack (✅ Implemented)

- **Cloud Run Service**: `koborin-ai-web-prod`.
  - Ingress: `INGRESS_TRAFFIC_INTERNAL_LOAD_BALANCER` (LB-only access).
  - Execution Environment: Gen2.
  - Environment Variables:
    - `NODE_ENV=production` (runtime mode).
    - `NEXT_PUBLIC_ENV=prod` (client-side environment identifier).
  - Scaling: Min 0, Max 10.

## Contact & Analytics Design (planned)

- Contact form will post to `/api/contact` (Astro API Route) with:
  - Payload validation (Zod), reCAPTCHA enforcement, structured logging to Cloud Logging.
  - Notification via SendGrid or Gmail API (configured via Secret Manager).
- `/api/track` endpoint will receive custom events and forward to Cloud Logging/BigQuery.
- GA4 integration via Google Tag Manager (prod: standard measurement, dev: DebugView only).

## Documentation

- `README.md`: quickstart + architectural highlights (this file).
- `AGENTS.md`: contribution workflow, review checklist, release rules, IaC philosophy.
- `docs/`: deeper specs (contact API design, observability runbooks, MDX authoring tips).

## Current Status

- ✅ **Infrastructure**:
  - Shared stack: HTTPS LB, Artifact Registry, Workload Identity (DNS handled via Cloudflare manually).
  - Dev stack: Cloud Run service (`koborin-ai-web-dev`).
  - Prod stack: Cloud Run service (`koborin-ai-web-prod`).
- ✅ **CI/CD**: GitHub Actions workflows for plan/apply (shared/dev/prod) with Workload Identity Federation.
- ✅ **Documentation**: README with architecture diagram, AGENTS.md with coding standards and IaC philosophy.
- ✅ **Testing**: Unit tests with 100% coverage for infrastructure code.
- ⏳ **Application**: Astro app to be scaffolded.
- ⏳ **Content**: MDX authoring workflow to be established.
