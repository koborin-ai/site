package stacks

import (
	"github.com/pulumi/pulumi-gcp/sdk/v8/go/gcp/cloudrunv2"
	"github.com/pulumi/pulumi/sdk/v3/go/pulumi"
	"github.com/pulumi/pulumi/sdk/v3/go/pulumi/config"
)

// Prod creates Cloud Run service for the production environment.
// The service is referenced by the Serverless NEG created in shared stack.
func Prod(ctx *pulumi.Context) error {
	cfg := config.New(ctx, "")
	gcpCfg := config.New(ctx, "gcp")

	projectID := gcpCfg.Require("project")
	imageURI := cfg.Require("imageUri")

	// Cloud Run V2 Service for prod
	webProd, err := cloudrunv2.NewService(ctx, "web-prod", &cloudrunv2.ServiceArgs{
		Project:  pulumi.String(projectID),
		Location: pulumi.String("asia-northeast1"),
		Name:     pulumi.String("koborin-ai-web-prod"),
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
							Value: pulumi.String("production"),
						},
						// NEXT_PUBLIC_ENV: client-side environment detection (legacy, kept for compatibility)
						&cloudrunv2.ServiceTemplateContainerEnvArgs{
							Name:  pulumi.String("NEXT_PUBLIC_ENV"),
							Value: pulumi.String("prod"),
						},
					},
				},
			},
			Scaling: &cloudrunv2.ServiceTemplateScalingArgs{
				MinInstanceCount: pulumi.Int(0),
				MaxInstanceCount: pulumi.Int(10),
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

	// Grant public access to prod Cloud Run service
	_, err = cloudrunv2.NewServiceIamMember(ctx, "web-prod-invoker", &cloudrunv2.ServiceIamMemberArgs{
		Project:  pulumi.String(projectID),
		Location: pulumi.String("asia-northeast1"),
		Name:     webProd.Name,
		Role:     pulumi.String("roles/run.invoker"),
		Member:   pulumi.String("allUsers"),
	})
	if err != nil {
		return err
	}

	return nil
}

