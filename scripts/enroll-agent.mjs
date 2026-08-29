#!/usr/bin/env node
import path from 'node:path';
import { enrollAgent, parseArgs, prettyJson, readJson } from './lib/profile-core.mjs';

try {
  const options = parseArgs(process.argv.slice(2));
  if (!options.root || !options.request) throw new Error('root_and_request_required');
  const result = enrollAgent(path.resolve(options.root), readJson(path.resolve(options.request)));
  process.stdout.write(prettyJson(result));
} catch (error) {
  console.error(`ENROLLMENT ERROR ${error.code || error.message}`);
  process.exitCode = 2;
}
