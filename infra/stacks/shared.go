package stacks

import (
	"strings"

	"github.com/pulumi/pulumi-gcp/sdk/v8/go/gcp/artifactregistry"
	"github.com/pulumi/pulumi-gcp/sdk/v8/go/gcp/compute"
	"github.com/pulumi/pulumi-gcp/sdk/v8/go/gcp/iam"
	"github.com/pulumi/pulumi-gcp/sdk/v8/go/gcp/iap"
	"github.com/pulumi/pulumi-gcp/sdk/v8/go/gcp/projects"
	"github.com/pulumi/pulumi-gcp/sdk/v8/go/gcp/serviceaccount"
	"github.com/pulumi/pulumi/sdk/v3/go/pulumi"
	"github.com/pulumi/pulumi/sdk/v3/go/pulumi/config"
)

// Shared creates resources for the shared stack.
func Shared(ctx *pulumi.Context) error {
	cfg := config.New(ctx, "")
	gcpCfg := config.New(ctx, "gcp")

	projectID := gcpCfg.Require("project")
	projectNumber := cfg.Require("projectNumber")
	iapUser := cfg.Require("iapUser")
	oauthClientID := cfg.Require("oauthClientId")
	oauthClientSecret := cfg.RequireSecret("oauthClientSecret")

	// ========================================
	// Enable Required APIs
	// ========================================

	requiredAPIs := []string{
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
	}

	var apiServices []pulumi.Resource
	for _, api := range requiredAPIs {
		// Logical name: api-<api-with-dots-replaced-by-dashes>
		// e.g., "api-run-googleapis-com"
		logicalName := "api-" + strings.ReplaceAll(api, ".", "-")
		svc, err := projects.NewService(ctx, logicalName, &projects.ServiceArgs{
			Project:                  pulumi.String(projectID),
			Service:                  pulumi.String(api),
			DisableDependentServices: pulumi.Bool(false),
			DisableOnDestroy:         pulumi.Bool(false),
		})
		if err != nil {
			return err
		}
		apiServices = append(apiServices, svc)
	}

	// ========================================
	// Artifact Registry
	// ========================================

	_, err := artifactregistry.NewRepository(ctx, "artifact-registry", &artifactregistry.RepositoryArgs{
		Project:      pulumi.String(projectID),
		Location:     pulumi.String("asia-northeast1"),
		RepositoryId: pulumi.String("koborin-ai-web"),
		Description:  pulumi.String("Container images for koborin.ai web application (dev/prod)"),
		Format:       pulumi.String("DOCKER"),
		DockerConfig: &artifactregistry.RepositoryDockerConfigArgs{
			ImmutableTags: pulumi.Bool(true),
		},
	}, pulumi.DependsOn(apiServices))
	if err != nil {
		return err
	}

	// ========================================
	// Global Static IP
	// ========================================

	staticIP, err := compute.NewGlobalAddress(ctx, "global-ip", &compute.GlobalAddressArgs{
		Project:     pulumi.String(projectID),
		Name:        pulumi.String("koborin-ai-global-ip"),
		AddressType: pulumi.String("EXTERNAL"),
		IpVersion:   pulumi.String("IPV4"),
		Description: pulumi.String("Static IP for koborin.ai HTTPS load balancer"),
	}, pulumi.DependsOn(apiServices))
	if err != nil {
		return err
	}

	// ========================================
	// Dev Environment Backend
	// ========================================

	// Serverless NEG for dev Cloud Run
	devNEG, err := compute.NewRegionNetworkEndpointGroup(ctx, "dev-neg", &compute.RegionNetworkEndpointGroupArgs{
		Project:             pulumi.String(projectID),
		Region:              pulumi.String("asia-northeast1"),
		Name:                pulumi.String("koborin-ai-dev-neg"),
		NetworkEndpointType: pulumi.String("SERVERLESS"),
		CloudRun: &compute.RegionNetworkEndpointGroupCloudRunArgs{
			Service: pulumi.String("koborin-ai-web-dev"),
		},
	}, pulumi.DependsOn(apiServices))
	if err != nil {
		return err
	}

	// Backend Service for dev (with IAP)
	devBackend, err := compute.NewBackendService(ctx, "dev-backend", &compute.BackendServiceArgs{
		Project:              pulumi.String(projectID),
		Name:                 pulumi.String("koborin-ai-dev-backend"),
		Protocol:             pulumi.String("HTTP"),
		LoadBalancingScheme:  pulumi.String("EXTERNAL_MANAGED"),
		TimeoutSec:           pulumi.Int(30),
		CustomResponseHeaders: pulumi.StringArray{pulumi.String("X-Robots-Tag: noindex, nofollow")},
		Backends: compute.BackendServiceBackendArray{
			&compute.BackendServiceBackendArgs{
				Group:          devNEG.ID(),
				BalancingMode:  pulumi.String("UTILIZATION"),
				CapacityScaler: pulumi.Float64(1.0),
			},
		},
		Iap: &compute.BackendServiceIapArgs{
			Enabled:            pulumi.Bool(true),
			Oauth2ClientId:     pulumi.String(oauthClientID),
			Oauth2ClientSecret: oauthClientSecret,
		},
	}, pulumi.DependsOn([]pulumi.Resource{devNEG}))
	if err != nil {
		return err
	}

	// IAP access control for dev
	_, err = iap.NewWebBackendServiceIamBinding(ctx, "dev-iap-access", &iap.WebBackendServiceIamBindingArgs{
		Project:           pulumi.String(projectID),
		WebBackendService: devBackend.Name,
		Role:              pulumi.String("roles/iap.httpsResourceAccessor"),
		Members:           pulumi.StringArray{pulumi.Sprintf("user:%s", iapUser)},
	}, pulumi.DependsOn([]pulumi.Resource{devBackend}))
	if err != nil {
		return err
	}

	// ========================================
	// Prod Environment Backend
	// ========================================

	// Serverless NEG for prod Cloud Run
	prodNEG, err := compute.NewRegionNetworkEndpointGroup(ctx, "prod-neg", &compute.RegionNetworkEndpointGroupArgs{
		Project:             pulumi.String(projectID),
		Region:              pulumi.String("asia-northeast1"),
		Name:                pulumi.String("koborin-ai-prod-neg"),
		NetworkEndpointType: pulumi.String("SERVERLESS"),
		CloudRun: &compute.RegionNetworkEndpointGroupCloudRunArgs{
			Service: pulumi.String("koborin-ai-web-prod"),
		},
	}, pulumi.DependsOn(apiServices))
	if err != nil {
		return err
	}

	// Backend Service for prod (no IAP)
	prodBackend, err := compute.NewBackendService(ctx, "prod-backend", &compute.BackendServiceArgs{
		Project:             pulumi.String(projectID),
		Name:                pulumi.String("koborin-ai-prod-backend"),
		Protocol:            pulumi.String("HTTP"),
		LoadBalancingScheme: pulumi.String("EXTERNAL_MANAGED"),
		TimeoutSec:          pulumi.Int(30),
		Backends: compute.BackendServiceBackendArray{
			&compute.BackendServiceBackendArgs{
				Group:          prodNEG.ID(),
				BalancingMode:  pulumi.String("UTILIZATION"),
				CapacityScaler: pulumi.Float64(1.0),
			},
		},
		LogConfig: &compute.BackendServiceLogConfigArgs{
			Enable:     pulumi.Bool(true),
			SampleRate: pulumi.Float64(1.0),
		},
	}, pulumi.DependsOn([]pulumi.Resource{prodNEG}))
	if err != nil {
		return err
	}

	// ========================================
	// HTTPS Load Balancer
	// ========================================

	// Managed SSL Certificate (multi-domain)
	sslCert, err := compute.NewManagedSslCertificate(ctx, "managed-cert", &compute.ManagedSslCertificateArgs{
		Project: pulumi.String(projectID),
		Name:    pulumi.String("koborin-ai-cert"),
		Managed: &compute.ManagedSslCertificateManagedArgs{
			Domains: pulumi.StringArray{
				pulumi.String("koborin.ai"),
				pulumi.String("dev.koborin.ai"),
			},
		},
	}, pulumi.DependsOn(apiServices))
	if err != nil {
		return err
	}

	// URL Map (host-based routing)
	urlMap, err := compute.NewURLMap(ctx, "url-map", &compute.URLMapArgs{
		Project:        pulumi.String(projectID),
		Name:           pulumi.String("koborin-ai-url-map"),
		Description:    pulumi.String("Routes traffic to dev/prod backends based on host header"),
		DefaultService: prodBackend.ID(),
		HostRules: compute.URLMapHostRuleArray{
			&compute.URLMapHostRuleArgs{
				Hosts:       pulumi.StringArray{pulumi.String("koborin.ai")},
				PathMatcher: pulumi.String("prod-matcher"),
			},
			&compute.URLMapHostRuleArgs{
				Hosts:       pulumi.StringArray{pulumi.String("dev.koborin.ai")},
				PathMatcher: pulumi.String("dev-matcher"),
			},
		},
		PathMatchers: compute.URLMapPathMatcherArray{
			&compute.URLMapPathMatcherArgs{
				Name:           pulumi.String("prod-matcher"),
				DefaultService: prodBackend.ID(),
			},
			&compute.URLMapPathMatcherArgs{
				Name:           pulumi.String("dev-matcher"),
				DefaultService: devBackend.ID(),
			},
		},
	}, pulumi.DependsOn([]pulumi.Resource{devBackend, prodBackend}))
	if err != nil {
		return err
	}

	// Target HTTPS Proxy
	httpsProxy, err := compute.NewTargetHttpsProxy(ctx, "https-proxy", &compute.TargetHttpsProxyArgs{
		Project: pulumi.String(projectID),
		Name:    pulumi.String("koborin-ai-https-proxy"),
		UrlMap:  urlMap.ID(),
		SslCertificates: pulumi.StringArray{
			sslCert.ID(),
		},
	}, pulumi.DependsOn([]pulumi.Resource{urlMap, sslCert}))
	if err != nil {
		return err
	}

	// Global Forwarding Rule
	_, err = compute.NewGlobalForwardingRule(ctx, "forwarding-rule", &compute.GlobalForwardingRuleArgs{
		Project:             pulumi.String(projectID),
		Name:                pulumi.String("koborin-ai-forwarding-rule"),
		Target:              httpsProxy.ID(),
		PortRange:           pulumi.String("443"),
		IpProtocol:          pulumi.String("TCP"),
		LoadBalancingScheme: pulumi.String("EXTERNAL_MANAGED"),
		NetworkTier:         pulumi.String("PREMIUM"),
		IpAddress:           staticIP.Address,
	}, pulumi.DependsOn([]pulumi.Resource{httpsProxy, staticIP}))
	if err != nil {
		return err
	}

	// ========================================
	// Workload Identity (for GitHub Actions)
	// ========================================

	// Workload Identity Pool
	workloadIdentityPool, err := iam.NewWorkloadIdentityPool(ctx, "github-actions-pool", &iam.WorkloadIdentityPoolArgs{
		Project:                pulumi.String(projectID),
		WorkloadIdentityPoolId: pulumi.String("github-actions-pool"),
		DisplayName:            pulumi.String("github-actions-pool"),
		Description:            pulumi.String("Workload Identity Pool for GitHub Actions workflows"),
	})
	if err != nil {
		return err
	}

	// Workload Identity Provider (GitHub OIDC)
	_, err = iam.NewWorkloadIdentityPoolProvider(ctx, "github-provider", &iam.WorkloadIdentityPoolProviderArgs{
		Project:                        pulumi.String(projectID),
		WorkloadIdentityPoolId:         workloadIdentityPool.WorkloadIdentityPoolId,
		WorkloadIdentityPoolProviderId: pulumi.String("actions-firebase-provider"),
		DisplayName:                    pulumi.String("github-actions-provider"),
		Description:                    pulumi.String("GitHub Actions OIDC provider"),
		// Only allow workflows from repositories owned by nozomi-koborinai
		AttributeCondition: pulumi.String(`assertion.repository_owner == "nozomi-koborinai"`),
		AttributeMapping: pulumi.StringMap{
			"google.subject":             pulumi.String("assertion.repository"),
			"attribute.repository_owner": pulumi.String("assertion.repository_owner"),
		},
		Oidc: &iam.WorkloadIdentityPoolProviderOidcArgs{
			IssuerUri: pulumi.String("https://token.actions.githubusercontent.com"),
		},
	})
	if err != nil {
		return err
	}

	// Service Account for Pulumi deployment
	githubActionsSA, err := serviceaccount.NewAccount(ctx, "github-actions-sa", &serviceaccount.AccountArgs{
		Project:     pulumi.String(projectID),
		AccountId:   pulumi.String("github-actions-service"),
		DisplayName: pulumi.String("github-actions-service"),
		Description: pulumi.String("Service account for GitHub Actions to deploy via Pulumi"),
	})
	if err != nil {
		return err
	}

	// Allow Workload Identity Pool to impersonate the service account
	_, err = serviceaccount.NewIAMMember(ctx, "github-wif-user", &serviceaccount.IAMMemberArgs{
		ServiceAccountId: githubActionsSA.Name,
		Role:             pulumi.String("roles/iam.workloadIdentityUser"),
		Member: pulumi.Sprintf(
			"principal://iam.googleapis.com/projects/%s/locations/global/workloadIdentityPools/%s/subject/nozomi-koborinai/koborin-ai",
			projectNumber,
			workloadIdentityPool.WorkloadIdentityPoolId,
		),
	})
	if err != nil {
		return err
	}

	// Grant necessary roles to the deployer service account
	deployerRoles := []string{
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
	}

	for _, role := range deployerRoles {
		// Logical name: deployer-sa-<role-with-dots-and-slashes-replaced-by-dashes>
		// e.g., "deployer-sa-roles-artifactregistry-admin"
		logicalName := "deployer-sa-" + strings.ReplaceAll(strings.ReplaceAll(role, ".", "-"), "/", "-")
		_, err = projects.NewIAMMember(ctx, logicalName, &projects.IAMMemberArgs{
			Project: pulumi.String(projectID),
			Role:    pulumi.String(role),
			Member:  pulumi.Sprintf("serviceAccount:%s", githubActionsSA.Email),
		})
		if err != nil {
			return err
		}
	}

	return nil
}

