package stacks

import (
	"fmt"

	"github.com/pulumi/pulumi-gcp/sdk/v8/go/gcp/cloudrunv2"
	"github.com/pulumi/pulumi/sdk/v3/go/pulumi"
	"github.com/pulumi/pulumi/sdk/v3/go/pulumi/config"
)

// Dev creates Cloud Run service for the development environment.
// The service is referenced by the Serverless NEG created in shared stack.
func Dev(ctx *pulumi.Context) error {
	cfg := config.New(ctx, "")
	gcpCfg := config.New(ctx, "gcp")

	projectID := gcpCfg.Require("project")
	projectNumber := cfg.Require("projectNumber")
	imageURI := cfg.Require("imageUri")

	// Cloud Run V2 Service for dev
	webDev, err := cloudrunv2.NewService(ctx, "web-dev", &cloudrunv2.ServiceArgs{
		Project:  pulumi.String(projectID),
		Location: pulumi.String("asia-northeast1"),
		Name:     pulumi.String("koborin-ai-web-dev"),
		Ingress:  pulumi.String("INGRESS_TRAFFIC_INTERNAL_LOAD_BALANCER"),
		Template: &cloudrunv2.ServiceTemplateArgs{
			ExecutionEnvironment: pulumi.String("EXECUTION_ENVIRONMENT_GEN2"),
			Containers: cloudrunv2.ServiceTemplateContainerArray{
				&cloudrunv2.ServiceTemplateContainerArgs{
					Image: pulumi.String(imageURI),
					Envs: cloudrunv2.ServiceTemplateContainerEnvArray{
						// NODE_ENV: server-side environment detection
						&cloudrunv2.ServiceTemplateContainerEnvArgs{
							Name:  pulumi.String("NODE_ENV"),
							Value: pulumi.String("development"),
						},
						// NEXT_PUBLIC_ENV: client-side environment detection (legacy, kept for compatibility)
						&cloudrunv2.ServiceTemplateContainerEnvArgs{
							Name:  pulumi.String("NEXT_PUBLIC_ENV"),
							Value: pulumi.String("dev"),
						},
					},
				},
			},
			Scaling: &cloudrunv2.ServiceTemplateScalingArgs{
				MinInstanceCount: pulumi.Int(0),
				MaxInstanceCount: pulumi.Int(1),
			},
		},
		Traffics: cloudrunv2.ServiceTrafficArray{
			&cloudrunv2.ServiceTrafficArgs{
				Type:    pulumi.String("TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"),
				Percent: pulumi.Int(100),
			},
		},
	})
	if err != nil {
		return err
	}

	// Grant Cloud Run Invoker role to IAP Service Agent
	// IAP uses this service account to invoke the Cloud Run service after authentication
	_, err = cloudrunv2.NewServiceIamMember(ctx, "web-dev-iap-invoker", &cloudrunv2.ServiceIamMemberArgs{
		Project:  pulumi.String(projectID),
		Location: pulumi.String("asia-northeast1"),
		Name:     webDev.Name,
		Role:     pulumi.String("roles/run.invoker"),
		Member:   pulumi.String(fmt.Sprintf("serviceAccount:service-%s@gcp-sa-iap.iam.gserviceaccount.com", projectNumber)),
	})
	if err != nil {
		return err
	}

	// ========================================
	// Exports
	// ========================================

	ctx.Export("serviceId", webDev.ID())
	ctx.Export("serviceName", webDev.Name)
	ctx.Export("serviceUri", webDev.Uri)

	return nil
}

