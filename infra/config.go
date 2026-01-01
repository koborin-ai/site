package main

import (
	"github.com/pulumi/pulumi/sdk/v3/go/pulumi"
	"github.com/pulumi/pulumi/sdk/v3/go/pulumi/config"
)

// SharedStackConfig holds configuration for the shared stack.
// Only environment-specific values are exposed as Pulumi config.
// Constants like region, domain names, and service names are hardcoded.
type SharedStackConfig struct {
	ProjectID         string
	ProjectNumber     string
	IAPUser           string
	OAuthClientID     string
	OAuthClientSecret pulumi.StringOutput
}

// EnvironmentStackConfig holds configuration for dev/prod stacks.
// Only the container image URI varies per deployment.
type EnvironmentStackConfig struct {
	ProjectID     string
	ProjectNumber string
	ImageURI      string
}

// GetSharedStackConfig reads Pulumi config and returns SharedStackConfig.
// Only truly variable values are injected from GitHub Actions.
func GetSharedStackConfig(ctx *pulumi.Context) SharedStackConfig {
	cfg := config.New(ctx, "")
	gcpCfg := config.New(ctx, "gcp")

	return SharedStackConfig{
		ProjectID:         gcpCfg.Require("project"),
		ProjectNumber:     cfg.Require("projectNumber"),
		IAPUser:           cfg.Require("iapUser"),
		OAuthClientID:     cfg.Require("oauthClientId"),
		OAuthClientSecret: cfg.RequireSecret("oauthClientSecret"),
	}
}

// GetEnvironmentStackConfig reads Pulumi config and returns EnvironmentStackConfig.
// Only the image URI is injected from GitHub Actions.
func GetEnvironmentStackConfig(ctx *pulumi.Context) EnvironmentStackConfig {
	cfg := config.New(ctx, "")
	gcpCfg := config.New(ctx, "gcp")

	return EnvironmentStackConfig{
		ProjectID:     gcpCfg.Require("project"),
		ProjectNumber: cfg.Require("projectNumber"),
		ImageURI:      cfg.Require("imageUri"),
	}
}

