import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { assertSchema, readJson } from '../scripts/lib/profile-core.mjs';
import {
  classifyExecution, validateRuntimeCapabilityDeclaration
} from '../scripts/lib/runtime-capabilities-candidate.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const examplePath = path.join(root, 'candidates/v1.1.0/runtime-capability.example.json');
const schemaPath = path.join(root, 'candidates/v1.1.0/schemas/runtime-capability-profile.schema.json');

test('1.1 candidate classifies by evidence rather than runtime vendor', () => {
  const example = readJson(examplePath);
  assertSchema(example, readJson(schemaPath), 'runtime-capability-example');
  assert.equal(classifyExecution(example).computed_execution_class, 'interactive-tool');
  assert.equal(classifyExecution(example).status, 'VERIFIED');
  assert.equal(classifyExecution(example).automatic_model_execution_enabled, false);
});

test('persistent execution and continuous service require successively stronger evidence', () => {
  const persistent = readJson(examplePath);
  persistent.claimed_execution_class = 'persistent-execution';
  persistent.capabilities.between_turn_execution.status = 'GO';
  persistent.capabilities.between_turn_execution.mechanism = 'fictional scheduled process';
  persistent.capabilities.between_turn_execution.evidence = 'Fictional between-turn probe passed.';
  assert.equal(classifyExecution(persistent).computed_execution_class, 'persistent-execution');

  const continuous = structuredClone(persistent);
  continuous.claimed_execution_class = 'continuous-service';
  continuous.capabilities.service_supervision.status = 'GO';
  continuous.capabilities.service_supervision.mechanism = 'fictional supervisor';
  continuous.capabilities.service_supervision.evidence = 'Fictional restart probe passed.';
  assert.equal(classifyExecution(continuous).computed_execution_class, 'continuous-service');
});

test('vendor-name overclaim and evidence-free capability fail closed', () => {
  const overclaim = readJson(examplePath);
  overclaim.runtime_id = 'famous-vendor-does-not-prove-runtime';
  overclaim.claimed_execution_class = 'continuous-service';
  assert.equal(classifyExecution(overclaim).status, 'NO_GO_OVERCLAIM');

  const noEvidence = readJson(examplePath);
  noEvidence.capabilities.git.evidence = 'none';
  assert.throws(() => validateRuntimeCapabilityDeclaration(noEvidence), /runtime_capability_evidence_required/);
});

test('session-only runtimes cannot claim persistent credential or between-turn capability', () => {
  const session = readJson(examplePath);
  session.claimed_execution_class = 'session-only';
  session.capabilities.filesystem.status = 'NO-GO';
  session.capabilities.git.status = 'NO-GO';
  session.capabilities.durable_persistence.status = 'NO-GO';
  session.capabilities.credential_custody.status = 'GO';
  assert.throws(() => validateRuntimeCapabilityDeclaration(session), /session_only_persistent_capability_claim/);
  session.capabilities.credential_custody.status = 'NO-GO';
  session.capabilities.between_turn_execution.status = 'GO';
  assert.throws(() => validateRuntimeCapabilityDeclaration(session), /session_only_persistent_capability_claim/);
});

test('automatic model execution requires separate authority and is disabled in the candidate', () => {
  const invalid = readJson(examplePath);
  invalid.automatic_model_execution.enabled = true;
  assert.throws(() => validateRuntimeCapabilityDeclaration(invalid), /runtime_automatic_model_authority_required/);
  const manifest = readJson(path.join(root, 'release/candidates/environment-profiles-v1.1.0.json'));
  assert.equal(manifest.claims.automatic_model_execution_enabled, false);
  assert.equal(manifest.immutable_tag_exists, false);
  assert.equal(manifest.communications_dependency.immutable_tag_exists, false);
});

test('1.1 group-store repository function is additive and preserves pairwise 1.0', () => {
  const functions = readJson(path.join(root, 'candidates/v1.1.0/repository-functions.json'));
  assertSchema(functions, readJson(path.join(root, 'candidates/v1.1.0/schemas/repository-functions-v1.1.schema.json')), 'candidate-repository-functions');
  assert.ok(functions.functions.some((item) => item.function_id === 'nx-to-recipient' && item.lifecycle === 'released-v1.0'));
  const group = functions.functions.find((item) => item.function_id === 'nx-message-store');
  assert.equal(group.default_name, 'nx-msg-<publisher-environment-id>-<group-id>');
  assert.equal(group.writer, 'publisher-environment-only');
  assert.equal(functions.compatibility.migration, 'parallel-additive-no-rename');
});

test('candidate implementation is standard-library-only and has no model or network call', () => {
  const source = fs.readFileSync(path.join(root, 'scripts/lib/runtime-capabilities-candidate.mjs'), 'utf8');
  assert.equal(/node:https|\bfetch\s*\(|OpenAI|generateContent|model\.generate/i.test(source), false);
});
