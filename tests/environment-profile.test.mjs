import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  ProfileError, acquireLease, acknowledgeInternalMessage, assertChannelWrite, assertSafeContent, buildProvisioningProposal,
  enrollAgent, materializeProfile, proposeExternalMessage, publishImmutable, readJson, releaseLease, sha256,
  stableStringify, updateReaderState, validateCapabilityDeclaration
} from '../scripts/lib/profile-core.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const baseRequest = readJson(path.join(root, 'fixtures/provisioning-request.example.json'));
const agentA = readJson(path.join(root, 'fixtures/enrollment-request-agent-a.json'));
const agentB = readJson(path.join(root, 'fixtures/enrollment-request-agent-b.json'));

function fixtureRoot(t, request = baseRequest) {
  const destination = fs.mkdtempSync(path.join(os.tmpdir(), 'nx-profile-test-'));
  t.after(() => fs.rmSync(destination, { recursive: true, force: true }));
  const proposal = buildProvisioningProposal(structuredClone(request));
  materializeProfile(proposal, destination);
  return { destination, proposal };
}

function expectCode(fn, code) {
  assert.throws(fn, (error) => error instanceof ProfileError && error.code === code);
}

test('01 fresh sovereign genesis is a verified prerequisite', () => {
  const proposal = buildProvisioningProposal(structuredClone(baseRequest));
  assert.deepEqual(proposal.genesis, baseRequest.genesis);
  const invalid = structuredClone(baseRequest);
  invalid.genesis.state = 'claimed';
  expectCode(() => buildProvisioningProposal(invalid), 'verified_genesis_required');
});

test('02 persistent-multi-agent mode is selected explicitly', () => {
  assert.equal(buildProvisioningProposal(structuredClone(baseRequest)).mode, 'persistent-multi-agent');
});

test('03 exact dry-run repository proposal is deterministic', () => {
  const left = buildProvisioningProposal(structuredClone(baseRequest));
  const right = buildProvisioningProposal(structuredClone(baseRequest));
  assert.equal(stableStringify(left), stableStringify(right));
  assert.equal(stableStringify(left), stableStringify(readJson(path.join(root, 'fixtures/provisioning-proposal.example.json'))));
  assert.equal(left.dry_run, true);
  assert.deepEqual(left.repositories.map((item) => item.name), ['example-owner/nx-agent-control', 'example-owner/nx-agent-ops', 'example-owner/nx-communications']);
});

test('04 materialization creates empty control and operations stores', (t) => {
  const { destination } = fixtureRoot(t);
  assert.deepEqual(readJson(path.join(destination, '.nx-profile/control/agent-registry.json')).agents, []);
  assert.deepEqual(readJson(path.join(destination, '.nx-profile/ops/messages/index.json')).records, []);
  assert.deepEqual(readJson(path.join(destination, '.nx-profile/ops/leases/index.json')).current, []);
});

test('05 two distinct fictional agents enroll with different adapters', (t) => {
  const { destination } = fixtureRoot(t);
  assert.equal(enrollAgent(destination, structuredClone(agentA)).status, 'ENROLLED');
  assert.equal(enrollAgent(destination, structuredClone(agentB)).status, 'ENROLLED');
  const agents = readJson(path.join(destination, '.nx-profile/control/agent-registry.json')).agents;
  assert.deepEqual(agents.map((item) => [item.agent_id, item.runtime_adapter]), [['EXAMPLE_AGENT_A', 'codex'], ['EXAMPLE_AGENT_B', 'gemini-cli']]);
});

test('06 Agent A publishes an immutable internal goal', (t) => {
  const { destination } = fixtureRoot(t);
  const goal = { schema_version: '1.0.0', goal_id: 'example-goal-0001', owner: 'EXAMPLE_AGENT_A', objective: 'Produce a fictional result.', scope: ['fictional'], external_authority: [], status: 'active', created_at: '2030-01-01T00:20:00.000Z', immutable: true };
  assert.equal(publishImmutable(destination, 'goals', goal.goal_id, goal).status, 'CREATED');
});

test('07 Agent B acquires the goal lease with observed-state CAS', (t) => {
  const { destination } = fixtureRoot(t);
  const acquired = acquireLease(destination, { resource_id: 'example-goal-0001', owner_agent: 'EXAMPLE_AGENT_B', goal_id: 'example-goal-0001', observed_digest: null }, new Date('2030-01-01T00:21:00.000Z'));
  assert.equal(acquired.status, 'ACQUIRED');
  assert.equal(acquired.lease.generation, 1);
});

test('08 concurrent lease acquisition loses safely', (t) => {
  const { destination } = fixtureRoot(t);
  acquireLease(destination, { resource_id: 'example-resource', owner_agent: 'EXAMPLE_AGENT_B', goal_id: 'example-goal', observed_digest: null }, new Date('2030-01-01T00:21:00.000Z'));
  expectCode(() => acquireLease(destination, { resource_id: 'example-resource', owner_agent: 'EXAMPLE_AGENT_A', goal_id: 'other-goal', observed_digest: null }, new Date('2030-01-01T00:21:01.000Z')), 'lease_compare_and_swap_lost');
});

test('09 Agent B publishes an internal result', (t) => {
  const { destination } = fixtureRoot(t);
  const result = { schema_version: '1.0.0', message_id: 'message-example-result-0001', environment_id: 'example-lab', from_agent: 'EXAMPLE_AGENT_B', to: 'EXAMPLE_AGENT_A', goal_id: 'example-goal-0001', kind: 'result', body: { fictional: true, result: 'complete' }, created_at: '2030-01-01T00:22:00.000Z', immutable: true };
  assert.equal(publishImmutable(destination, 'messages', result.message_id, result).status, 'CREATED');
});

test('10 Agent A acknowledges an existing result with a separate record', (t) => {
  const { destination } = fixtureRoot(t);
  const message = { message_id: 'message-example-result-0001', body: { fictional: true } };
  publishImmutable(destination, 'messages', message.message_id, message);
  const ack = { schema_version: '1.0.0', ack_id: 'ack-example-result-0001', message_id: message.message_id, from_agent: 'EXAMPLE_AGENT_A', state: 'received', created_at: '2030-01-01T00:23:00.000Z', immutable: true };
  assert.equal(acknowledgeInternalMessage(destination, ack).status, 'CREATED');
});

test('11 usage and event summaries publish immutably', (t) => {
  const { destination } = fixtureRoot(t);
  assert.equal(publishImmutable(destination, 'usage', 'usage-example-0001', { record_id: 'usage-example-0001', metrics: { total: null }, source: 'fictional' }).status, 'CREATED');
  assert.equal(publishImmutable(destination, 'events', 'event-example-0001', { event_id: 'event-example-0001', summary: 'Fictional completion.' }).status, 'CREATED');
});

test('12 unread/read state never mutates immutable messages', (t) => {
  const { destination } = fixtureRoot(t);
  const message = { message_id: 'message-example-unread-0001', body: { fictional: true } };
  const published = publishImmutable(destination, 'messages', message.message_id, message);
  const before = sha256(fs.readFileSync(published.path));
  updateReaderState(destination, { reader_id: 'EXAMPLE_AGENT_A', stream_id: 'internal', record_id: message.message_id, record_digest: before, updated_at: '2030-01-01T00:24:00.000Z' });
  assert.equal(sha256(fs.readFileSync(published.path)), before);
});

test('13 a third agent enrolls without duplicating repositories', (t) => {
  const { destination, proposal } = fixtureRoot(t);
  enrollAgent(destination, structuredClone(agentA));
  const third = structuredClone(agentB);
  third.agent_id = 'EXAMPLE_AGENT_C';
  third.enrollments[0].agent_id = third.agent_id;
  third.enrollments[0].enrollment_id = 'enrollment-agent-c-ops';
  const repositorySnapshot = stableStringify(proposal.repositories);
  enrollAgent(destination, third);
  assert.equal(stableStringify(proposal.repositories), repositorySnapshot);
  assert.equal(readJson(path.join(destination, '.nx-profile/control/agent-registry.json')).agents.length, 2);
});

test('14 external pairwise publication remains separate from internal messages', (t) => {
  const { destination } = fixtureRoot(t);
  const channels = readJson(path.join(destination, '.nx-profile/external-channels.json'));
  assert.deepEqual(channels.channels, []);
  assert.equal(fs.existsSync(path.join(destination, '.nx-profile/ops/outbound')), false);
});

test('15 session-only mode creates no persistent infrastructure', (t) => {
  const request = structuredClone(baseRequest);
  request.mode = 'session-only';
  const proposal = buildProvisioningProposal(request);
  const destination = path.join(os.tmpdir(), `nx-session-only-${process.pid}-${Date.now()}`);
  t.after(() => { if (fs.existsSync(destination)) fs.rmSync(destination, { recursive: true, force: true }); });
  const result = materializeProfile(proposal, destination);
  assert.equal(result.persistent, false);
  assert.equal(fs.existsSync(destination), false);
});

test('16 single-agent mode never creates or claims multi-agent operations', (t) => {
  const request = structuredClone(baseRequest);
  request.mode = 'persistent-single-agent';
  const { destination } = fixtureRoot(t, request);
  assert.equal(fs.existsSync(path.join(destination, '.nx-profile/ops')), false);
  assert.equal(buildProvisioningProposal(request).repositories.length, 1);
});

test('17 missing future runtime capabilities remain unknown or blocked', () => {
  const adapter = readJson(path.join(root, 'adapters/future-unknown.json'));
  assert.equal(adapter.filesystem.status, 'UNKNOWN');
  assert.equal(adapter.deployment_boundary.status, 'NO-GO');
});

test('18 public profile contains no credential signatures or live private state', () => {
  const source = fs.readFileSync(path.join(root, 'fixtures/two-agent-scenario.json'), 'utf8');
  assert.doesNotThrow(() => assertSafeContent(JSON.parse(source)));
  assert.equal(/github_pat_|-----BEGIN .*PRIVATE KEY-----/.test(source), false);
});

test('19 existing Codex legacy names map without migration', () => {
  const mappings = readJson(path.join(root, 'profiles/persistent-multi-agent-github/repository-functions.json')).legacy_mappings;
  assert.deepEqual(Object.fromEntries(mappings.map((item) => [item.legacy_name, item.function_id])), { 'ai-agent-control': 'nx-agent-control', 'ai-agent-ops': 'nx-agent-ops', 'nx-codex-communications_dev': 'nx-communications' });
  assert.ok(mappings.every((item) => item.migration === 'none-required'));
});

test('20 all runtime renderers preserve identical neutral semantic keys', () => {
  const profile = readJson(path.join(root, 'profiles/persistent-multi-agent-github/profile.json'));
  const capabilityKeys = ['instruction_loading', 'filesystem', 'git', 'secure_github', 'persistent_storage', 'background_scheduling', 'cross_prompt_activation', 'subagents', 'inbox_events', 'secret_storage', 'deployment_boundary'];
  for (const id of profile.runtime_adapters) assert.ok(capabilityKeys.every((key) => Object.hasOwn(readJson(path.join(root, 'adapters', `${id}.json`)), key)), id);
});

test('21 release validator requires one exact annotated tag object and target', () => {
  const source = fs.readFileSync(path.join(root, 'scripts/validate-release.mjs'), 'utf8');
  for (const proof of ["cat-file', '-t'", "rev-list', '-n', '1'", "rev-parse', 'HEAD'", "environment-profiles-v1.0.0"]) assert.ok(source.includes(proof));
});

test('22 rollback resolves previous exact control and communications anchors', () => {
  const rollback = readJson(path.join(root, 'release/rollback-anchors.json'));
  assert.equal(rollback.known_good.control.tag, 'standard-2026.08.28.1');
  assert.equal(rollback.known_good.communications.tag, 'communications-v0.6.0');
  assert.match(rollback.known_good.control.tag_object, /^[a-f0-9]{40}$/);
  assert.match(rollback.known_good.communications.tag_target, /^[a-f0-9]{40}$/);
});

test('23 adverse: planner never silently applies repository creation', () => {
  const proposal = buildProvisioningProposal(structuredClone(baseRequest));
  assert.equal(proposal.dry_run, true);
  assert.deepEqual(proposal.external_effects, ['None. This is a dry-run proposal and performs no provider mutation.']);
});

test('24 adverse: duplicate environment provisioning is refused', () => {
  const request = structuredClone(baseRequest);
  request.existing_repositories = { 'nx-agent-control': 'example-owner/existing-control' };
  expectCode(() => buildProvisioningProposal(request), 'existing_environment_requires_enroll_existing');
});

test('25 adverse: agent identity and private memory inheritance are prohibited', (t) => {
  const { destination } = fixtureRoot(t);
  const request = { ...structuredClone(agentA), inherited_identity: 'PARENT_AGENT' };
  expectCode(() => enrollAgent(destination, request), 'identity_or_memory_inheritance_prohibited');
});

test('26 adverse: self-registration without owner authority is refused', (t) => {
  const { destination } = fixtureRoot(t);
  const request = structuredClone(agentA);
  delete request.authority_ref;
  expectCode(() => enrollAgent(destination, request), 'enrollment_authority_required');
});

test('27 adverse: self-granted GO capability is refused', () => {
  expectCode(() => validateCapabilityDeclaration({ capabilities: { 'github.write': { state: 'GO', authority: 'declared', evidence: 'self claim' } } }), 'self_granted_capability');
});

test('28 adverse: cross-owner external writes are refused', () => {
  expectCode(() => assertChannelWrite({ single_writer: true, publisher_owner: 'publisher-a' }, 'recipient-b'), 'cross_owner_write_prohibited');
});

test('29 adverse: credential signatures in configuration are refused', () => {
  expectCode(() => assertSafeContent({ value: `github_pat_${'A'.repeat(30)}` }), 'credential_signature_found');
});

test('30 adverse: private operations fields cannot enter external messages', () => {
  const channel = { channel_id: 'channel-example', publisher_owner: 'publisher-a', single_writer: true };
  const goal = { external_authority: ['publish:channel-example'] };
  const message = { message_id: 'message-external-0001', source_commit: 'a'.repeat(40), source_path: 'messages/example.json', content_digest: 'b'.repeat(64), protocol_version: '1.0.0', internal_usage: {} };
  expectCode(() => proposeExternalMessage(channel, goal, 'publisher-a', message), 'private_operations_in_external_message');
});

test('31 adverse: fabricated runtime GO claims require non-self evidence', () => {
  expectCode(() => validateCapabilityDeclaration({ capabilities: { scheduling: { state: 'GO', authority: 'observed', evidence: 'none' } } }), 'capability_evidence_required');
});

test('32 adverse: acknowledgement cannot fabricate delivery', (t) => {
  const { destination } = fixtureRoot(t);
  expectCode(() => acknowledgeInternalMessage(destination, { ack_id: 'ack-missing-0001', message_id: 'message-missing-0001' }), 'fabricated_acknowledgement_source_missing');
});

test('33 adverse: stale duplicate transport is deduplicated in reader-owned state', (t) => {
  const { destination } = fixtureRoot(t);
  const request = { reader_id: 'EXAMPLE_AGENT_A', stream_id: 'external', record_id: 'message-0001', record_digest: 'c'.repeat(64), updated_at: '2030-01-01T00:30:00.000Z' };
  updateReaderState(destination, request);
  const state = updateReaderState(destination, request);
  assert.equal(state.seen_digests.length, 1);
});

test('34 adverse: stale lease release loses compare-and-swap', (t) => {
  const { destination } = fixtureRoot(t);
  const acquired = acquireLease(destination, { resource_id: 'example-resource', owner_agent: 'EXAMPLE_AGENT_A', goal_id: 'example-goal', observed_digest: null }, new Date('2030-01-01T00:31:00.000Z'));
  expectCode(() => releaseLease(destination, { resource_id: 'example-resource', owner_agent: 'EXAMPLE_AGENT_A', lease_id: acquired.lease.lease_id, observed_digest: '0'.repeat(64) }), 'lease_compare_and_swap_lost');
});

test('35 adverse: force-push behavior is absent from executable tooling', () => {
  const scripts = fs.readdirSync(path.join(root, 'scripts')).filter((name) => name.endsWith('.mjs')).map((name) => fs.readFileSync(path.join(root, 'scripts', name), 'utf8')).join('\n') + fs.readFileSync(path.join(root, 'scripts/lib/profile-core.mjs'), 'utf8');
  assert.equal(/git[^\n]*(?:--force|-f\b)|force:\s*true/.test(scripts), false);
});

test('36 adverse: family packages cannot grant infrastructure authority', () => {
  const profile = readJson(path.join(root, 'profiles/persistent-multi-agent-github/profile.json'));
  assert.ok(profile.authority_rules.some((rule) => /Family adoption never grants infrastructure/.test(rule)));
});

test('37 adverse: application databases are not authoritative operations', () => {
  const docs = fs.readFileSync(path.join(root, 'docs/SECURITY_AND_PRIVACY.md'), 'utf8');
  assert.match(docs, /Application databases are mission state, not authoritative operations/);
});

test('38 adverse: external publication without goal authority is refused', () => {
  const channel = { channel_id: 'channel-example', publisher_owner: 'publisher-a', single_writer: true };
  const message = { message_id: 'message-external-0001', source_commit: 'a'.repeat(40), source_path: 'messages/example.json', content_digest: 'b'.repeat(64), protocol_version: '1.0.0' };
  expectCode(() => proposeExternalMessage(channel, { external_authority: [] }, 'publisher-a', message), 'external_message_goal_authority_required');
});

test('39 adverse: apply mode requires an explicit authority reference', () => {
  expectCode(() => buildProvisioningProposal(structuredClone(baseRequest), true), 'apply_authority_required');
});

test('40 adverse: external channel creation requires exact recipient authority', () => {
  const request = structuredClone(baseRequest);
  request.external_recipient = 'fictional-recipient';
  expectCode(() => buildProvisioningProposal(request), 'external_channel_authority_required');
});
