/// Dev Cloud Run service for koborin.ai.
///
/// Dev Cloud Run stack (TerraDart → Terraform).
library;

import 'package:terradart_core/terradart_core.dart';
import 'package:terradart_google/cloud_run.dart';
import 'package:terradart_google/provider.dart';

const _region = 'asia-northeast1';
const _serviceName = 'koborin-ai-web-dev';

/// Dev stack: Cloud Run service + IAP invoker binding.
final class DevStack extends Stack {
  DevStack({
    required String projectId,
    required String projectNumber,
  }) : super(
          providers: [
            GoogleProvider(project: projectId, region: _region),
          ],
        ) {
    final webDev = add(
      GoogleCloudRunV2Service(
        localName: 'web_dev',
        name: TfArg.literal(_serviceName),
        location: TfArg.literal(_region),
        ingress: TfArg.literal(Ingress.internalLoadBalancer),
        deletionProtection: TfArg.literal(false),
        template: CloudRunV2ServiceTemplate(
          executionEnvironment: TfArg.literal(ExecutionEnvironment.gen2),
          containers: [
            CloudRunV2ServiceServiceContainer(
              image: TfArg.variable('image_uri'),
              env: [
                CloudRunV2ServiceEnvVar(
                  name: TfArg.literal('NODE_ENV'),
                  source: CloudRunV2ServiceEnvVarFromLiteral(
                    TfArg.literal('development'),
                  ),
                ),
                CloudRunV2ServiceEnvVar(
                  name: TfArg.literal('NEXT_PUBLIC_ENV'),
                  source: CloudRunV2ServiceEnvVarFromLiteral(
                    TfArg.literal('dev'),
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
            maxInstanceCount: TfArg.literal(1),
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
        localName: 'web_dev_iap_invoker',
        name: TfArg.ref(webDev.nameRef),
        location: TfArg.literal(_region),
        role: TfArg.literal('roles/run.invoker'),
        member: TfArg.literal(
          'serviceAccount:service-$projectNumber@gcp-sa-iap.iam.gserviceaccount.com',
        ),
        dependsOn: [ResourceDependency(webDev)],
      ),
    );
  }
}
