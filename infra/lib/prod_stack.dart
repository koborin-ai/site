/// Prod Cloud Run service for koborin.ai.
///
/// Prod Cloud Run stack (TerraDart → Terraform).
library;

import 'package:terradart_core/terradart_core.dart';
import 'package:terradart_google/cloud_run.dart';
import 'package:terradart_google/provider.dart';

const _region = 'asia-northeast1';
const _serviceName = 'koborin-ai-web-prod';

/// Prod stack: Cloud Run service + public invoker binding.
final class ProdStack extends Stack {
  ProdStack({required String projectId})
      : super(
          providers: [
            GoogleProvider(project: projectId, region: _region),
          ],
        ) {
    final webProd = add(
      GoogleCloudRunV2Service(
        localName: 'web_prod',
        name: TfArg.literal(_serviceName),
        location: TfArg.literal(_region),
        ingress: TfArg.literal(Ingress.internalLoadBalancer),
        template: CloudRunV2ServiceTemplate(
          executionEnvironment: TfArg.literal(ExecutionEnvironment.gen2),
          containers: [
            CloudRunV2ServiceServiceContainer(
              image: TfArg.variable('image_uri'),
              env: [
                CloudRunV2ServiceEnvVar(
                  name: TfArg.literal('NODE_ENV'),
                  source: CloudRunV2ServiceEnvVarFromLiteral(
                    TfArg.literal('production'),
                  ),
                ),
                CloudRunV2ServiceEnvVar(
                  name: TfArg.literal('NEXT_PUBLIC_ENV'),
                  source: CloudRunV2ServiceEnvVarFromLiteral(
                    TfArg.literal('prod'),
                  ),
                ),
              ],
              resources: CloudRunV2ServiceContainerResources(
                startupCpuBoost: TfArg.literal(true),
                cpuIdle: TfArg.literal(true),
              ),
            ),
          ],
          scaling: CloudRunV2ServiceTemplateScaling(
            minInstanceCount: TfArg.literal(0),
            maxInstanceCount: TfArg.literal(10),
          ),
        ),
        traffic: [
          CloudRunV2ServiceTraffic(
            type: TfArg.literal(TrafficTargetAllocationType.latest),
            percent: TfArg.literal(100),
          ),
        ],
      ),
    );

    add(
      GoogleCloudRunV2ServiceIamMember(
        localName: 'web_prod_invoker',
        name: TfArg.ref(webProd.nameRef),
        location: TfArg.literal(_region),
        role: TfArg.literal('roles/run.invoker'),
        member: TfArg.literal('allUsers'),
        dependsOn: [ResourceDependency(webProd)],
      ),
    );
  }
}
