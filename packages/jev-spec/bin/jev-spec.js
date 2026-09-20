#!/usr/bin/env node
import { checkCommand } from '../dist/cli/commands/check.js';

function parseArgs(args) {
  const options = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--config' || arg === '-c') {
      options.config = args[++i];
    } else if (arg === '--zone' || arg === '-z') {
      options.zone = args[++i];
    } else if (arg === '--format' || arg === '-f') {
      options.format = args[++i];
    } else if (arg === 'check') {
      options.command = 'check';
    }
  }
  return options;
}

const args = process.argv.slice(2);
const options = parseArgs(args);

const exitCode = await checkCommand(options);
process.exit(exitCode);
