#!/usr/bin/env node
import path from 'node:path';
import { parseArgs, prettyJson, readJson } from './lib/profile-core.mjs';

try {
  const options = parseArgs(process.argv.slice(2));
  if (!options.adapter) throw new Error('adapter_required');
  const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(?:[A-Za-z]:)/, (value) => value.slice(1))), '..');
  const adapter = readJson(path.join(root, 'adapters', `${options.adapter}.json`));
  process.stdout.write(prettyJson({ profile_id: 'persistent-multi-agent-github', profile_version: '1.0.0', adapter }));
} catch (error) {
  console.error(`ADAPTER ERROR ${error.code || error.message}`);
  process.exitCode = 2;
}
