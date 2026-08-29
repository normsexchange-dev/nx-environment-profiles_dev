#!/usr/bin/env node
import path from 'node:path';
import { materializeProfile, parseArgs, prettyJson, readJson } from './lib/profile-core.mjs';

try {
  const options = parseArgs(process.argv.slice(2));
  if (!options.proposal || !options.output) throw new Error('proposal_and_output_required');
  const proposal = readJson(path.resolve(options.proposal));
  const result = materializeProfile(proposal, path.resolve(options.output));
  process.stdout.write(prettyJson(result));
} catch (error) {
  console.error(`MATERIALIZATION ERROR ${error.code || error.message}`);
  process.exitCode = 2;
}
