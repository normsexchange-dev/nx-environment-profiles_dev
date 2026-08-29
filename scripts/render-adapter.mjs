#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs, prettyJson, readJson } from './lib/profile-core.mjs';

try {
  const options = parseArgs(process.argv.slice(2));
  if (!options.adapter) throw new Error('adapter_required');
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const adapter = readJson(path.join(root, 'adapters', `${options.adapter}.json`));
  process.stdout.write(prettyJson({ profile_id: 'persistent-multi-agent-github', profile_version: '1.0.0', adapter }));
} catch (error) {
  console.error(`ADAPTER ERROR ${error.code || error.message}`);
  process.exitCode = 2;
}
