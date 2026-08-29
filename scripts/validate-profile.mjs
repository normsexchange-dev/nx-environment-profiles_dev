#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CREDENTIAL_PATTERNS, assert, assertSafeContent, assertSchema, readJson } from './lib/profile-core.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TAG = 'environment-profiles-v1.0.0';
const REQUIRED = [
  '.github/workflows/validate-profile.yml', 'CHANGELOG.md', 'README.md', 'VERSION', 'package.json',
  'registry/profiles.json', 'profiles/persistent-multi-agent-github/profile.json', 'profiles/persistent-multi-agent-github/repository-functions.json',
  'release/rollback-anchors.json', 'adapters/semantics.json',
  'docs/ARCHITECTURE.md', 'docs/PROVISIONING_AND_ENROLLMENT.md', 'docs/OPERATIONS_AND_CHANNELS.md', 'docs/LIFECYCLE_RECOVERY.md', 'docs/SECURITY_AND_PRIVACY.md', 'docs/RUNTIME_ADAPTERS.md', 'docs/GOOGLE_AI_STUDIO.md', 'docs/MIGRATION_AND_COMPATIBILITY.md',
  'scripts/lib/profile-core.mjs', 'scripts/plan-provisioning.mjs', 'scripts/materialize-profile.mjs', 'scripts/enroll-agent.mjs', 'scripts/render-adapter.mjs', 'scripts/validate-profile.mjs', 'scripts/validate-release.mjs',
  'tests/environment-profile.test.mjs', 'fixtures/provisioning-request.example.json', 'fixtures/enrollment-request-agent-a.json', 'fixtures/enrollment-request-agent-b.json'
];
const SCHEMA_BINDINGS = [
  ['registry/profiles.json', 'schemas/profile-registry.schema.json'],
  ['profiles/persistent-multi-agent-github/profile.json', 'schemas/profile.schema.json'],
  ['profiles/persistent-multi-agent-github/repository-functions.json', 'schemas/repository-functions.schema.json'],
  ['fixtures/provisioning-proposal.example.json', 'schemas/provisioning-proposal.schema.json'],
  ['fixtures/environment-adoption.example.json', 'schemas/environment-adoption.schema.json']
];

function git(args) {
  return execFileSync('git', ['-c', `safe.directory=${root.replaceAll('\\', '/')}`, '-C', root, ...args], { encoding: 'utf8' }).trim();
}

function walk(directory, relative = '') {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (['.git', 'node_modules', '.tmp'].includes(entry.name)) continue;
    const child = relative ? `${relative}/${entry.name}` : entry.name;
    if (entry.isDirectory()) files.push(...walk(path.join(directory, entry.name), child));
    else if (entry.isFile()) files.push(child);
  }
  return files.sort();
}

try {
  const branchIndex = process.argv.indexOf('--branch');
  const actualBranch = git(['branch', '--show-current']);
  const branch = branchIndex >= 0 ? process.argv[branchIndex + 1] : actualBranch;
  assert(branch, 'branch_required');
  assert(branch === 'main' || branch === TAG || /^agent\/[A-Za-z0-9_]+\/[a-z0-9.-]+$/.test(branch), 'branch_invalid');
  if (actualBranch) assert(branch === actualBranch, 'branch_mismatch', { requested: branch, actual: actualBranch });
  const files = walk(root);
  for (const file of REQUIRED) assert(files.includes(file), 'required_file_missing', { file });
  assert(fs.readFileSync(path.join(root, 'VERSION'), 'utf8').trim() === '1.0.0', 'version_invalid');
  for (const [recordPath, schemaPath] of SCHEMA_BINDINGS) assertSchema(readJson(path.join(root, recordPath)), readJson(path.join(root, schemaPath)), recordPath);
  const schemaFiles = files.filter((file) => file.startsWith('schemas/') && file.endsWith('.schema.json'));
  assert(schemaFiles.length >= 20, 'schema_surface_incomplete');
  for (const file of schemaFiles) {
    const schema = readJson(path.join(root, file));
    assert(schema.$schema === 'https://json-schema.org/draft/2020-12/schema', 'schema_draft_invalid', { file });
    assert(schema.$id === `https://raw.githubusercontent.com/normsexchange-dev/nx-environment-profiles_dev/${TAG}/${file}`, 'schema_release_identity_invalid', { file });
    assert(schema.type === 'object' && schema.additionalProperties === false, 'schema_not_restrictive', { file });
  }
  const profile = readJson(path.join(root, 'profiles/persistent-multi-agent-github/profile.json'));
  assert(profile.environment_modes.length === 4 && profile.runtime_adapters.length === 7, 'profile_matrix_incomplete');
  const semantics = readJson(path.join(root, 'adapters/semantics.json')).semantic_contract;
  const expectedCapabilityKeys = ['instruction_loading', 'filesystem', 'git', 'secure_github', 'persistent_storage', 'background_scheduling', 'cross_prompt_activation', 'subagents', 'inbox_events', 'secret_storage', 'deployment_boundary'];
  for (const adapterId of profile.runtime_adapters) {
    const adapter = readJson(path.join(root, 'adapters', `${adapterId}.json`));
    assertSchema(adapter, readJson(path.join(root, 'schemas/runtime-adapter.schema.json')), adapterId);
    assert(expectedCapabilityKeys.every((key) => Object.hasOwn(adapter, key)), 'adapter_semantics_missing', { adapterId });
    assert(semantics.length === 8, 'neutral_semantics_invalid');
  }
  const functions = readJson(path.join(root, 'profiles/persistent-multi-agent-github/repository-functions.json'));
  assert(functions.functions.length === 4 && functions.legacy_mappings.length === 3, 'repository_function_model_invalid');
  const rollback = readJson(path.join(root, 'release/rollback-anchors.json'));
  for (const anchor of Object.values(rollback.known_good)) {
    assert(/^[a-f0-9]{40}$/.test(anchor.tag_object) && /^[a-f0-9]{40}$/.test(anchor.tag_target), 'rollback_anchor_invalid');
  }
  const workflow = fs.readFileSync(path.join(root, '.github/workflows/validate-profile.yml'), 'utf8');
  assert(/permissions:\s*\r?\n\s+contents:\s*read/.test(workflow) && !/contents:\s*write/.test(workflow), 'workflow_permissions_invalid');
  assert(/actions\/checkout@[a-f0-9]{40}/.test(workflow) && /actions\/setup-node@[a-f0-9]{40}/.test(workflow), 'workflow_actions_not_pinned');
  const allText = [];
  for (const file of files) {
    const buffer = fs.readFileSync(path.join(root, file));
    if (buffer.includes(0)) continue;
    const text = buffer.toString('utf8');
    allText.push(text);
    assert(!CREDENTIAL_PATTERNS.some((pattern) => pattern.test(text)), 'credential_signature_found', { file });
    assert(!/[A-Za-z]:[\\/]Users[\\/]/.test(text) && !/(?:^|\s)\/(?:home|Users)\/[A-Za-z0-9._-]+\//m.test(text), 'private_local_path_found', { file });
    assert(!/normsexchange-gemini\//i.test(text), 'foreign_private_topology_found', { file });
    if (file.endsWith('.json')) assertSafeContent(readJson(path.join(root, file)), file);
    if (file.endsWith('.mjs')) for (const match of text.matchAll(/^import .* from ['"]([^'"]+)['"];$/gm)) assert(match[1].startsWith('node:') || match[1].startsWith('.'), 'third_party_import', { file, import: match[1] });
  }
  const combined = allText.join('\n');
  for (const phrase of ['session-only', 'persistent-single-agent', 'persistent-multi-agent', 'enroll-existing', 'provision once', 'compare-and-swap', 'publisher-owned']) assert(combined.toLowerCase().includes(phrase), 'required_concept_missing', { phrase });
  assert(combined.includes('https://ai.google.dev/gemini-api/docs/aistudio-build-mode') && combined.includes('https://ai.google.dev/gemini-api/docs/aistudio-deploying') && combined.includes('https://ai.google.dev/gemini-api/docs/ai-studio-quickstart'), 'google_ai_studio_sources_missing');
  assert(!/\bfetch\s*\(/.test(fs.readFileSync(path.join(root, 'scripts/plan-provisioning.mjs'), 'utf8') + fs.readFileSync(path.join(root, 'scripts/materialize-profile.mjs'), 'utf8')), 'offline_tools_network_access');
  console.log(`validate-profile: PASS (${files.length} files; ${schemaFiles.length} strict schemas; 7 adapters; branch ${branch})`);
} catch (error) {
  console.error(`VALIDATION ERROR ${error.code || error.message}${error.details ? ` ${JSON.stringify(error.details)}` : ''}`);
  process.exitCode = 2;
}
