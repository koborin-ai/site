import * as pulumi from "@pulumi/pulumi"

/**
 * Configuration for shared stack.
 * Only environment-specific values are exposed as Pulumi config.
 * Constants like region, domain names, and service names are hardcoded.
 */
export interface SharedStackConfig {
  projectId: string
  projectNumber: string
  iapUser: string
  oauthClientId: string
  oauthClientSecret: pulumi.Output<string>
}

/**
 * Configuration for dev/prod stacks.
 * Only the container image URI varies per deployment.
 */
export interface EnvironmentStackConfig {
  projectId: string
  projectNumber: string
  imageUri: string
}

/**
 * Creates configuration for shared stack by reading Pulumi config.
 * Only truly variable values are injected from GitHub Actions.
 */
export function getSharedStackConfig(): SharedStackConfig {
  const config = new pulumi.Config()
  const gcpConfig = new pulumi.Config("gcp")

  return {
    projectId: gcpConfig.require("project"),
    projectNumber: config.require("projectNumber"),
    iapUser: config.require("iapUser"),
    oauthClientId: config.require("oauthClientId"),
    oauthClientSecret: config.requireSecret("oauthClientSecret"),
  }
}

/**
 * Creates configuration for dev/prod stacks.
 * Only the image URI is injected from GitHub Actions.
 */
export function getEnvironmentStackConfig(): EnvironmentStackConfig {
  const config = new pulumi.Config()
  const gcpConfig = new pulumi.Config("gcp")

  return {
    projectId: gcpConfig.require("project"),
    projectNumber: config.require("projectNumber"),
    imageUri: config.require("imageUri"),
  }
}

