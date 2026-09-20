import { defineConfig, noul, choice, score } from '../../src/index.js';

export default defineConfig({
  client: {
    mock: true,
  },
  zones: {
    auth: {
      description: 'Authentication session token verification',
      specPath: 'test/fixtures/specs/auth-requirements.md',
      codePaths: ['test/fixtures/src/auth.ts'],
      specFilter: {
        requirementPrefix: 'REQ-AUTH-',
      },
      rubrics: {
        satisfiesRequirements: noul(
          'Does the code satisfy functional criteria defined in REQ-AUTH-01 and REQ-AUTH-02?'
        ),
        introducesUnspecifiedBehavior: noul(
          'Does the implementation introduce undocumented endpoints or behavior?'
        ),
        securityPosture: choice('Security posture of session management', {
          secure: 'Proper signature validation and revocation checks present',
          insecure: 'Missing verification or tokens logged',
        }),
        implementationCompleteness: score('Degree of completeness', [
          'Stub',
          'Basic',
          'Feature Complete',
        ]),
      },
      assertions: {
        satisfiesRequirements: { minProbability: 0.80 },
        introducesUnspecifiedBehavior: { maxProbability: 0.15 },
        securityPosture: { allowedChoices: ['secure'], minConfidence: 0.70 },
        implementationCompleteness: { minScore: 1.5 },
      },
    },
  },
});
