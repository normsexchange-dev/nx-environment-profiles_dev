#!/usr/bin/env node
import path from 'node:path';
import { buildProvisioningProposal, parseArgs, prettyJson, readJson, writeJson } from './lib/profile-core.mjs';

try {
  const options = parseArgs(process.argv.slice(2));
  if (!options.request) throw new Error('request_required');
  const request = readJson(path.resolve(options.request));
  const proposal = buildProvisioningProposal(request, options.apply === true);
  if (options.output) writeJson(path.resolve(options.output), proposal);
  process.stdout.write(prettyJson(proposal));
} catch (error) {
  console.error(`PROVISIONING ERROR ${error.code || error.message}`);
  process.exitCode = 2;
}
