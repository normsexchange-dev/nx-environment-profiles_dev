#!/usr/bin/env node
import { execFileSync, spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assert, parseArgs } from './lib/profile-core.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
function git(args) { return execFileSync('git', ['-c', `safe.directory=${root.replaceAll('\\', '/')}`, '-C', root, ...args], { encoding: 'utf8' }).trim(); }

try {
  const options = parseArgs(process.argv.slice(2));
  const tag = options.tag;
  assert(tag === 'environment-profiles-v1.0.0', 'release_tag_invalid');
  const tagObject = git(['rev-parse', `refs/tags/${tag}`]);
  assert(git(['cat-file', '-t', `refs/tags/${tag}`]) === 'tag', 'release_tag_not_annotated');
  const tagTarget = git(['rev-list', '-n', '1', `refs/tags/${tag}`]);
  assert(git(['rev-parse', 'HEAD']) === tagTarget, 'release_checkout_not_tag_target');
  const validation = spawnSync(process.execPath, ['scripts/validate-profile.mjs', '--branch', tag], { cwd: root, encoding: 'utf8' });
  process.stdout.write(validation.stdout || ''); process.stderr.write(validation.stderr || '');
  assert(validation.status === 0, 'release_source_validation_failed');
  const tests = spawnSync(process.execPath, ['--test', 'tests/environment-profile.test.mjs'], { cwd: root, encoding: 'utf8' });
  process.stdout.write(tests.stdout || ''); process.stderr.write(tests.stderr || '');
  assert(tests.status === 0, 'release_tests_failed');
  console.log(`validate-release: PASS (${tag}; object ${tagObject}; target ${tagTarget})`);
} catch (error) {
  console.error(`RELEASE ERROR ${error.code || error.message}`);
  process.exitCode = 2;
}
