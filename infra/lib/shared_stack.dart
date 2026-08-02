/// Shared GCP infrastructure for koborin.ai.
///
/// Provisions the HTTPS load balancer (dev + prod backends), Artifact
/// Registry, Workload Identity Federation, IAP access, and deployer IAM.
/// Shared GCP infrastructure stack (TerraDart → Terraform).
library;

import 'package:terradart_core/terradart_core.dart';
import 'package:terradart_google/artifact_registry.dart';
import 'package:terradart_google/compute.dart';
import 'package:terradart_google/iam.dart';
import 'package:terradart_google/iap.dart';
import 'package:terradart_google/project.dart';
import 'package:terradart_google/provider.dart';

import 'stack_policy.dart';

const _region = 'asia-northeast1';

/// Shared stack: LB, WIF pool, Artifact Registry, deployer IAM.
final class SharedStack extends Stack {
  SharedStack({
    required String projectId,
    required String projectNumber,
  }) : super(
          providers: [
            GoogleProvider(project: projectId, region: _region),
          ],
        ) {
    final apiDeps = _enableApis();

    final staticIp = add(
      GoogleComputeGlobalAddress(
        localName: 'global_ip',
        name: TfArg.literal('koborin-ai-global-ip'),
        addressType: TfArg.literal(GlobalAddressType.external),
        ipVersion: TfArg.literal(GlobalAddressIpVersion.ipv4),
        description: TfArg.literal(
          'Static IP for koborin.ai HTTPS load balancer',
        ),
        dependsOn: apiDeps,
      ),
    );

    add(
      GoogleArtifactRegistryRepository(
        localName: 'artifact_registry',
        repositoryId: TfArg.literal('koborin-ai-web'),
        location: TfArg.literal(_region),
        description: TfArg.literal(
          'Container images for koborin.ai web application (dev/prod)',
        ),
        format: TfArg.literal('DOCKER'),
        dockerConfig: ArtifactRegistryRepositoryArtifactRegistryDockerConfig(
          immutableTags: TfArg.literal(true),
        ),
        dependsOn: apiDeps,
      ),
    );

    final devNeg = add(
      GoogleComputeRegionNetworkEndpointGroup(
        localName: 'dev_neg',
        name: TfArg.literal('koborin-ai-dev-neg'),
        region: TfArg.literal(_region),
        networkEndpointType: TfArg.literal(
          RegionNetworkEndpointGroupType.serverless,
        ),
        cloudRun:
            ComputeRegionNetworkEndpointGroupRegionNetworkEndpointGroupCloudRun(
          service: TfArg.literal('koborin-ai-web-dev'),
        ),
        dependsOn: apiDeps,
      ),
    );

    final devBackend = add(
      GoogleComputeBackendService(
        localName: 'dev_backend',
        name: TfArg.literal('koborin-ai-dev-backend'),
        protocol: TfArg.literal(BackendServiceProtocol.http),
        loadBalancingScheme: TfArg.literal(
          LoadBalancingScheme.externalManaged,
        ),
        timeoutSec: TfArg.literal(30),
        customResponseHeaders: TfArg.literal([
          'X-Robots-Tag: noindex, nofollow',
        ]),
        backends: [
          ComputeBackendServiceBackendServiceBackend(
            group: TfArg.ref(devNeg.selfLink),
            balancingMode: BackendServiceBalancingMode.utilization,
            capacityScaler: TfArg.literal(1.0),
          ),
        ],
        iap: ComputeBackendServiceBackendServiceIap(
          enabled: TfArg.literal(true),
          oauth2ClientId: TfArg.variable('oauth_client_id'),
          oauth2ClientSecret: TfArg.variable('oauth_client_secret'),
        ),
        dependsOn: [ResourceDependency(devNeg)],
      ),
    );

    add(
      GoogleIapWebBackendServiceIamBinding(
        localName: 'dev_iap_access',
        webBackendService: TfArg.ref(devBackend.nameRef),
        role: TfArg.literal('roles/iap.httpsResourceAccessor'),
        members: TfArg.literal([r'user:${var.iap_user}']),
        dependsOn: [ResourceDependency(devBackend)],
      ),
    );

    final prodNeg = add(
      GoogleComputeRegionNetworkEndpointGroup(
        localName: 'prod_neg',
        name: TfArg.literal('koborin-ai-prod-neg'),
        region: TfArg.literal(_region),
        networkEndpointType: TfArg.literal(
          RegionNetworkEndpointGroupType.serverless,
        ),
        cloudRun:
            ComputeRegionNetworkEndpointGroupRegionNetworkEndpointGroupCloudRun(
          service: TfArg.literal('koborin-ai-web-prod'),
        ),
        dependsOn: apiDeps,
      ),
    );

    final prodBackend = add(
      GoogleComputeBackendService(
        localName: 'prod_backend',
        name: TfArg.literal('koborin-ai-prod-backend'),
        protocol: TfArg.literal(BackendServiceProtocol.http),
        loadBalancingScheme: TfArg.literal(
          LoadBalancingScheme.externalManaged,
        ),
        timeoutSec: TfArg.literal(30),
        backends: [
          ComputeBackendServiceBackendServiceBackend(
            group: TfArg.ref(prodNeg.selfLink),
            balancingMode: BackendServiceBalancingMode.utilization,
            capacityScaler: TfArg.literal(1.0),
          ),
        ],
        logConfig: ComputeBackendServiceBackendServiceLogConfig(
          enable: TfArg.literal(true),
          sampleRate: TfArg.literal(1.0),
        ),
        dependsOn: [ResourceDependency(prodNeg)],
      ),
    );

    final sslCert = add(
      GoogleComputeManagedSslCertificate(
        localName: 'managed_cert',
        name: TfArg.literal('koborin-ai-cert'),
        managed: ComputeManagedSslCertificateManagedSslCertificateConfig(
          domains: ['koborin.ai', 'dev.koborin.ai'],
        ),
        dependsOn: apiDeps,
      ),
    );

    final urlMap = add(
      GoogleComputeUrlMap(
        localName: 'url_map',
        name: TfArg.literal('koborin-ai-url-map'),
        description: TfArg.literal(
          'Routes traffic to dev/prod backends based on host header',
        ),
        defaultService: TfArg.ref(prodBackend.selfLink),
        hostRules: [
          ComputeUrlMapUrlMapHostRule(
            hosts: ['koborin.ai'],
            pathMatcher: TfArg.literal('prod-matcher'),
          ),
          ComputeUrlMapUrlMapHostRule(
            hosts: ['dev.koborin.ai'],
            pathMatcher: TfArg.literal('dev-matcher'),
          ),
        ],
        pathMatchers: [
          ComputeUrlMapUrlMapPathMatcher(
            name: TfArg.literal('prod-matcher'),
            defaultService: TfArg.ref(prodBackend.selfLink),
          ),
          ComputeUrlMapUrlMapPathMatcher(
            name: TfArg.literal('dev-matcher'),
            defaultService: TfArg.ref(devBackend.selfLink),
          ),
        ],
        dependsOn: [
          ResourceDependency(devBackend),
          ResourceDependency(prodBackend),
        ],
      ),
    );

    final httpsProxy = add(
      GoogleComputeTargetHttpsProxy(
        localName: 'https_proxy',
        name: TfArg.literal('koborin-ai-https-proxy'),
        urlMap: TfArg.ref(urlMap.selfLink),
        sslCertificates: TfArg.literal([sslCert.selfLink.interpolation]),
        dependsOn: [
          ResourceDependency(urlMap),
          ResourceDependency(sslCert),
        ],
      ),
    );

    add(
      GoogleComputeGlobalForwardingRule(
        localName: 'forwarding_rule',
        name: TfArg.literal('koborin-ai-forwarding-rule'),
        target: TfArg.ref(httpsProxy.selfLink),
        ipAddress: TfArg.ref(staticIp.addressRef),
        portRange: TfArg.literal('443'),
        ipProtocol: TfArg.literal(GlobalForwardingRuleIpProtocol.tcp),
        loadBalancingScheme: TfArg.literal(
          GlobalForwardingRuleLoadBalancingScheme.externalManaged,
        ),
        networkTier: TfArg.literal(GlobalForwardingRuleNetworkTier.premium),
        dependsOn: [
          ResourceDependency(httpsProxy),
          ResourceDependency(staticIp),
        ],
      ),
    );

    final wifPool = add(
      GoogleIamWorkloadIdentityPool(
        localName: 'github_actions_pool',
        workloadIdentityPoolId: TfArg.literal('github-actions-pool'),
        displayName: TfArg.literal('github-actions-pool'),
        description: TfArg.literal(
          'Workload Identity Pool for GitHub Actions workflows',
        ),
      ),
    );

    add(
      GoogleIamWorkloadIdentityPoolProvider(
        localName: 'github_provider',
        // Short pool id — not the full `name` attribute path.
        workloadIdentityPoolId: TfArg.literal('github-actions-pool'),
        workloadIdentityPoolProviderId: TfArg.literal(
          'actions-firebase-provider',
        ),
        displayName: TfArg.literal('github-actions-provider'),
        description: TfArg.literal('GitHub Actions OIDC provider'),
        attributeCondition: TfArg.literal(
          'assertion.repository_owner == "koborin-ai"',
        ),
        attributeMapping: TfArg.literal({
          'google.subject': 'assertion.repository',
          'attribute.repository_owner': 'assertion.repository_owner',
        }),
        trustSource: IamWorkloadIdentityPoolProviderOidcTrust(
          issuerUri: TfArg.literal(
            'https://token.actions.githubusercontent.com',
          ),
        ),
        dependsOn: [ResourceDependency(wifPool)],
      ),
    );

    final githubActionsSa = add(
      GoogleServiceAccount(
        localName: 'github_actions_sa',
        accountId: TfArg.literal('github-actions-service'),
        displayName: TfArg.literal('github-actions-service'),
        description: TfArg.literal(
          'Service account for GitHub Actions to deploy via Pulumi',
        ),
      ),
    );

    final wifPrincipal = _wifPrincipal(projectNumber, 'github-actions-pool');

    add(
      GoogleServiceAccountIamMember(
        localName: 'github_wif_user',
        serviceAccountId: TfArg.ref(githubActionsSa.name),
        role: TfArg.literal('roles/iam.workloadIdentityUser'),
        member: TfArg.literal(wifPrincipal),
        dependsOn: [ResourceDependency(wifPool)],
      ),
    );

    for (final role in deployerSaRoles) {
      final logicalName = _deployerRoleLocalName(role);
      add(
        GoogleProjectIamMember(
          localName: logicalName,
          project: TfArg.literal(projectId),
          role: TfArg.literal(role),
          member: TfArg.ref(githubActionsSa.iamMember),
        ),
      );
    }
  }

  List<ResourceDependency> _enableApis() {
    final deps = <ResourceDependency>[];
    for (final api in requiredGcpApis) {
      final localName = _apiLocalName(api);
      final svc = add(
        GoogleProjectService(
          localName: localName,
          service: TfArg.literal(api),
          disableOnDestroy: TfArg.literal(false),
          disableDependentServices: TfArg.literal(false),
        ),
      );
      deps.add(ResourceDependency(svc));
    }
    return deps;
  }

  static String _apiLocalName(String api) =>
      'api_${api.replaceAll('.', '_')}';

  static String _deployerRoleLocalName(String role) =>
      'deployer_sa_${role.replaceAll('.', '_').replaceAll('/', '_')}';

  static String _wifPrincipal(String projectNumber, String poolId) =>
      'principal://iam.googleapis.com/projects/$projectNumber/'
      'locations/global/workloadIdentityPools/$poolId/'
      'subject/koborin-ai/site';
}
