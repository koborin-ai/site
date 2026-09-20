import type { OverallCheckResult, ZoneCheckResult } from '../types.js';

export function formatTerminalReport(result: OverallCheckResult): string {
  const lines: string[] = [];
  lines.push('\n=== jev-spec Verification Report ===\n');

  for (const zone of result.zones) {
    const icon = zone.passed ? '✔' : '✖';
    lines.push(`Zone: ${zone.zoneName} [${icon} ${zone.passed ? 'PASSED' : 'FAILED'}]`);
    lines.push(`  Spec files: ${zone.specFiles.join(', ')}`);
    lines.push(`  Code files: ${zone.codeFiles.join(', ')}`);

    for (const ev of zone.evaluations) {
      const statusIcon = ev.passed ? '✔' : '✖';
      let detail = '';
      if (ev.result.type === 'noul') {
        detail = `probability: ${ev.result.probability.toFixed(2)}`;
      } else if (ev.result.type === 'choice') {
        detail = `choice: "${ev.result.choice}" (conf: ${(ev.result.confidence * 100).toFixed(0)}%)`;
      } else if (ev.result.type === 'score') {
        detail = `score: ${ev.result.score.toFixed(1)}/${ev.result.maxScore.toFixed(1)} ("${ev.result.selectedLevel}")`;
      }

      lines.push(`    ${statusIcon} ${ev.rubricName}: ${detail}`);
      if (!ev.passed && ev.reason) {
        lines.push(`       └─ Violation: ${ev.reason}`);
      }
    }
    lines.push(`  Duration: ${zone.durationMs}ms | Est. cost: $${zone.estimatedCostUsd.toFixed(5)}\n`);
  }

  const overallIcon = result.passed ? '✔' : '✖';
  lines.push(`----------------------------------------`);
  lines.push(
    `Overall: ${overallIcon} ${result.passed ? 'ALL CHECKS PASSED' : 'VERIFICATION FAILED'} (${result.totalDurationMs}ms, $${result.totalEstimatedCostUsd.toFixed(5)})`
  );

  return lines.join('\n');
}

export function formatMarkdownReport(result: OverallCheckResult): string {
  const lines: string[] = [];
  lines.push('### 🛡️ `jev-spec` Verification Summary\n');
  lines.push('| Zone | Status | Passed Checks | Duration | Est. Cost |');
  lines.push('| :--- | :---: | :---: | :---: | :---: |');

  for (const zone of result.zones) {
    const passedCount = zone.evaluations.filter((e) => e.passed).length;
    const totalCount = zone.evaluations.length;
    const status = zone.passed ? '✅ PASS' : '❌ FAIL';
    lines.push(
      `| \`${zone.zoneName}\` | ${status} | ${passedCount}/${totalCount} | ${zone.durationMs}ms | $${zone.estimatedCostUsd.toFixed(5)} |`
    );
  }

  lines.push('\n<details><summary>Detailed Zone Breakdown</summary>\n');

  for (const zone of result.zones) {
    lines.push(`#### Zone: \`${zone.zoneName}\`\n`);
    lines.push('| Rubric | Type | Outcome | Status |');
    lines.push('| :--- | :---: | :--- | :---: |');

    for (const ev of zone.evaluations) {
      let outcome = '';
      if (ev.result.type === 'noul') {
        outcome = `Prob: ${ev.result.probability.toFixed(2)}`;
      } else if (ev.result.type === 'choice') {
        outcome = `\`${ev.result.choice}\` (${(ev.result.confidence * 100).toFixed(0)}%)`;
      } else if (ev.result.type === 'score') {
        outcome = `Score: ${ev.result.score.toFixed(1)}/${ev.result.maxScore.toFixed(1)} (${ev.result.selectedLevel})`;
      }
      const status = ev.passed ? '✅' : '❌';
      lines.push(`| \`${ev.rubricName}\` | \`${ev.result.type}\` | ${outcome} | ${status} |`);
    }
    lines.push('\n');
  }

  lines.push('</details>\n');
  return lines.join('\n');
}
