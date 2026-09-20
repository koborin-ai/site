#!/usr/bin/env node
import { checkCommand } from '../dist/cli/commands/check.js';

function parseArgs(args) {
  const options = { command: 'check' };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === 'check') {
      options.command = 'check';
      continue;
    }

    if (arg === '--config' || arg === '-c') {
      options.config = args[++i];
      continue;
    }

    if (arg === '--zone' || arg === '-z') {
      options.zone = args[++i];
      continue;
    }

    if (arg === '--format' || arg === '-f') {
      options.format = args[++i];
      continue;
    }

    if (arg === '--output' || arg === '-o') {
      options.output = args[++i];
      continue;
    }

    if (arg === '--staged') {
      options.staged = true;
      continue;
    }

    if (arg === '--diff') {
      const next = args[i + 1];
      if (next && !next.startsWith('-')) {
        options.diff = next;
        i++;
      } else {
        options.diff = true;
      }
      continue;
    }
  }

  return options;
}

const args = process.argv.slice(2);
const options = parseArgs(args);

if (options.command !== 'check') {
  console.error('[jev-spec] Usage: jev-spec check [--zone <name>] [--staged|--diff <range>] [--format terminal|markdown|json] [--output <file>]');
  process.exit(2);
}

const exitCode = await checkCommand(options);
process.exit(exitCode);
