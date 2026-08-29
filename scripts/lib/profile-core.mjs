import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

class ProfileError extends Error {
  constructor(code, details = {}) {
    super(code);
    this.code = code;
    this.details = details;
  }
}

function parseArgs(argv) {
  const parsed = { _: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (!item.startsWith('--')) {
      parsed._.push(item);
      continue;
    }
    const key = item.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) parsed[key] = true;
    else {
      parsed[key] = next;
      index += 1;
    }
  }
  return parsed;
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, ''));
  } catch (error) {
    throw new ProfileError('json_invalid', { file: filePath, reason: error.message });
  }
}

function prettyJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, prettyJson(value), 'utf8');
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

function sha256(value) {
  const input = Buffer.isBuffer(value) ? value : Buffer.from(String(value), 'utf8');
  return crypto.createHash('sha256').update(input).digest('hex');
}

function deterministicId(prefix, value) {
  return `${prefix}-${sha256(stableStringify(value)).slice(0, 24)}`;
}

function assert(condition, code, details = {}) {
  if (!condition) throw new ProfileError(code, details);
}

function typeMatches(value, expected) {
  if (expected === 'null') return value === null;
  if (expected === 'array') return Array.isArray(value);
  if (expected === 'object') return value !== null && typeof value === 'object' && !Array.isArray(value);
  if (expected === 'integer') return Number.isInteger(value);
  if (expected === 'number') return typeof value === 'number' && Number.isFinite(value);
  return typeof value === expected;
}

function resolvePointer(root, pointer) {
  assert(pointer.startsWith('#/'), 'schema_external_ref_unsupported', { pointer });
  return pointer.slice(2).split('/').reduce((current, part) => current[part.replaceAll('~1', '/').replaceAll('~0', '~')], root);
}

function validateSchema(value, schema, root = schema, location = '$') {
  const errors = [];
  if (schema.$ref) return validateSchema(value, resolvePointer(root, schema.$ref), root, location);
  if (Object.hasOwn(schema, 'const') && stableStringify(value) !== stableStringify(schema.const)) errors.push(`${location} must equal ${JSON.stringify(schema.const)}`);
  if (schema.enum && !schema.enum.some((candidate) => stableStringify(candidate) === stableStringify(value))) errors.push(`${location} is not allowed`);
  if (schema.type) {
    const allowed = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!allowed.some((expected) => typeMatches(value, expected))) return [`${location} has wrong type`];
  }
  if (typeof value === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength) errors.push(`${location} is too short`);
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) errors.push(`${location} does not match ${schema.pattern}`);
  }
  if (typeof value === 'number' && schema.minimum !== undefined && value < schema.minimum) errors.push(`${location} is below minimum`);
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) errors.push(`${location} has too few items`);
    if (schema.uniqueItems && new Set(value.map(stableStringify)).size !== value.length) errors.push(`${location} contains duplicates`);
    if (schema.items) value.forEach((item, index) => errors.push(...validateSchema(item, schema.items, root, `${location}[${index}]`)));
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const required of schema.required || []) if (!Object.hasOwn(value, required)) errors.push(`${location}.${required} is required`);
    for (const [key, child] of Object.entries(value)) {
      if (schema.properties && Object.hasOwn(schema.properties, key)) errors.push(...validateSchema(child, schema.properties[key], root, `${location}.${key}`));
      else if (schema.additionalProperties === false) errors.push(`${location}.${key} is not allowed`);
      else if (schema.additionalProperties && typeof schema.additionalProperties === 'object') errors.push(...validateSchema(child, schema.additionalProperties, root, `${location}.${key}`));
    }
  }
  return errors;
}

function assertSchema(value, schema, label = 'record') {
  const errors = validateSchema(value, schema);
  assert(errors.length === 0, 'schema_validation_failed', { label, errors });
  return value;
}

const CREDENTIAL_PATTERNS = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /github_pat_[A-Za-z0-9_]{20,}/,
  /gh[pousr]_[A-Za-z0-9]{20,}/,
  /sk-[A-Za-z0-9]{20,}/,
  /shp(?:at|ca|ss)_[A-Za-z0-9]{20,}/
];

function assertSafeContent(value, location = '$') {
  const forbiddenKeys = /(?:^|_)(?:password|passwd|secret_value|access_token|private_key|cookie|raw_prompt|raw_response|raw_reasoning|transcript)(?:$|_)/i;
  if (typeof value === 'string') {
    assert(!CREDENTIAL_PATTERNS.some((pattern) => pattern.test(value)), 'credential_signature_found', { location });
    assert(value.length <= 20000, 'oversized_string', { location });
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertSafeContent(item, `${location}[${index}]`));
    return;
  }
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      assert(!forbiddenKeys.test(key), 'forbidden_sensitive_field', { location: `${location}.${key}` });
      assertSafeContent(child, `${location}.${key}`);
    }
  }
}

const REPOSITORY_FUNCTIONS = {
  'nx-agent-control': { defaultName: 'nx-agent-control', visibility: 'private', dataClasses: ['policy', 'registries', 'projects', 'enrollments', 'capability-declarations', 'adoption-records'] },
  'nx-agent-ops': { defaultName: 'nx-agent-ops', visibility: 'private', dataClasses: ['internal-messages', 'acknowledgements', 'goals', 'leases', 'events', 'usage-summaries', 'branch-ownership', 'reader-state'] },
  'nx-communications': { defaultName: 'nx-communications', visibility: 'public', dataClasses: ['sanitized-protocol', 'genesis', 'interoperability', 'outbound-channel-contract'] }
};

function requiredFunctions(mode) {
  if (mode === 'session-only') return [];
  if (mode === 'persistent-single-agent') return ['nx-agent-control'];
  return ['nx-agent-control', 'nx-agent-ops', 'nx-communications'];
}

function normalizeRepositoryName(owner, name) {
  assert(/^[A-Za-z0-9_.-]+$/.test(owner), 'owner_invalid');
  assert(/^[A-Za-z0-9_.-]+$/.test(name), 'repository_name_invalid', { name });
  return `${owner}/${name}`;
}

function buildProvisioningProposal(request, apply = false) {
  assertSafeContent(request);
  const modes = new Set(['session-only', 'persistent-single-agent', 'persistent-multi-agent', 'enroll-existing']);
  assert(modes.has(request.mode), 'environment_mode_invalid');
  assert(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(request.environment_id || ''), 'environment_id_invalid');
  assert(typeof request.environment_owner === 'string' && request.environment_owner.length > 0, 'environment_owner_required');
  assert(request.genesis?.state === 'verified' && request.genesis.environment_id === request.environment_id && request.genesis.anchor, 'verified_genesis_required');
  if (apply) assert(typeof request.authority_ref === 'string' && request.authority_ref.length > 0, 'apply_authority_required');
  const existing = request.existing_repositories || {};
  if (request.mode !== 'enroll-existing') assert(Object.keys(existing).length === 0, 'existing_environment_requires_enroll_existing');
  if (request.mode === 'enroll-existing') {
    const requiredExisting = requiredFunctions('persistent-multi-agent');
    assert(requiredExisting.every((functionId) => typeof existing[functionId] === 'string'), 'existing_environment_discovery_incomplete');
    assert(request.agent_request && request.agent_request.agent_id, 'enrollment_request_required');
  }
  const repositories = [];
  for (const functionId of requiredFunctions(request.mode)) {
    const definition = REPOSITORY_FUNCTIONS[functionId];
    const existingName = existing[functionId];
    if (request.mode === 'enroll-existing') {
      assert(existingName.startsWith(`${request.environment_owner}/`) && /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(existingName), 'existing_repository_identity_invalid', { functionId });
    }
    const requestedName = request.repository_names?.[functionId] || definition.defaultName;
    const name = existingName || normalizeRepositoryName(request.environment_owner, requestedName);
    repositories.push({
      name,
      function_id: functionId,
      visibility: request.visibility?.[functionId] || definition.visibility,
      data_classes: definition.dataClasses,
      action: existingName ? 'connect-existing' : 'create'
    });
  }
  if (request.external_recipient) {
    assert(request.mode === 'persistent-multi-agent', 'external_channel_requires_multi_agent_mode');
    assert(request.external_channel_authority_ref, 'external_channel_authority_required');
    const recipient = String(request.external_recipient).toLowerCase().replace(/[^a-z0-9-]/g, '-');
    repositories.push({ name: normalizeRepositoryName(request.environment_owner, `nx-to-${recipient}`), function_id: 'nx-to-recipient', visibility: 'private', data_classes: ['authorized-outbound-messages', 'append-only-index'], action: 'create' });
  }
  const requestedPermissions = [];
  for (const repository of repositories) {
    if (repository.action === 'create') {
      requestedPermissions.push({ scope: repository.name, level: 'administration', reason: 'Create only the exact approved repository and configure its initial settings; reduce access after provisioning.' });
    } else if (repository.function_id === 'nx-communications') {
      requestedPermissions.push({ scope: repository.name, level: 'contents-read', reason: 'Discover and verify the sanitized interoperability contract without changing it.' });
    } else {
      requestedPermissions.push({ scope: repository.name, level: 'contents-write', reason: 'Enroll the authorized agent and publish governed records after branch and lease checks.' });
    }
  }
  const proposalBase = {
    schema_version: '1.0.0',
    profile: { id: 'persistent-multi-agent-github', version: '1.0.0' },
    genesis: { state: 'verified', environment_id: request.genesis.environment_id, anchor: request.genesis.anchor },
    mode: request.mode,
    environment_owner: request.environment_owner,
    environment_id: request.environment_id,
    repositories,
    agent_request: request.mode === 'enroll-existing' ? request.agent_request : null,
    requested_permissions: requestedPermissions,
    credential_mechanism: request.credential_mechanism || 'Selected-repository GitHub App or normal OAuth/device authentication with credentials stored only in the provider secret boundary; never prompts, source, logs, exports, browser storage, or model memory.',
    external_effects: apply ? repositories.filter((item) => item.action === 'create').map((item) => `Provider may create ${item.name} only after independently rechecking this exact proposal and authority.`) : ['None. This is a dry-run proposal and performs no provider mutation.'],
    manual_alternative: 'The owner may create or connect the exact repositories manually, then run deterministic verification and enroll each distinct agent.',
    unavailable_without_access: repositories.length ? ['Repository creation or connection', 'Remote branch and permission verification', 'Persistent coordination publication'] : ['No persistent functions are requested in session-only mode.'],
    dry_run: !apply,
    apply_authority: apply ? request.authority_ref : null,
    created_at: request.created_at || new Date().toISOString()
  };
  const proposal = { $schema: './schemas/provisioning-proposal.schema.json', proposal_id: deterministicId('proposal', proposalBase), ...proposalBase };
  assertSafeContent(proposal);
  return proposal;
}

function assertEmptyDestination(destination) {
  if (!fs.existsSync(destination)) return;
  assert(fs.statSync(destination).isDirectory(), 'destination_not_directory');
  assert(fs.readdirSync(destination).length === 0, 'destination_not_empty');
}

function materializeProfile(proposal, destination) {
  assertSafeContent(proposal);
  if (proposal.mode === 'session-only') return { status: 'SESSION_ONLY', files: [], persistent: false };
  assertEmptyDestination(destination);
  fs.mkdirSync(destination, { recursive: true });
  const files = [];
  const put = (relative, value) => {
    writeJson(path.join(destination, relative), value);
    files.push(relative.replaceAll('\\', '/'));
  };
  const common = { schema_version: '1.0.0', environment_id: proposal.environment_id };
  put('.nx-profile/adoption.json', { ...common, profile_id: proposal.profile.id, profile_version: proposal.profile.version, mode: proposal.mode, proposal_id: proposal.proposal_id, proposal_digest: sha256(stableStringify(proposal)), state: 'proposed-owner-review-required' });
  if (proposal.mode === 'enroll-existing') {
    put('.nx-profile/enrollment-request.json', { ...common, agent: proposal.agent_request || null, authority_required: true, infrastructure_created: false });
    return { status: 'ENROLLMENT_PROPOSAL', files, persistent: false };
  }
  put('.nx-profile/control/agent-registry.json', { ...common, agents: [] });
  put('.nx-profile/control/projects.json', { ...common, projects: [] });
  put('.nx-profile/control/capabilities.json', { ...common, declarations: [] });
  put('.nx-profile/control/adoptions.json', { ...common, records: [] });
  put('.nx-profile/audit/events.json', { ...common, events: [] });
  if (proposal.mode === 'persistent-multi-agent') {
    put('.nx-profile/ops/store.json', { ...common, append_only_directories: ['messages', 'acknowledgements', 'goals', 'events', 'usage', 'branches'], mutable_cas_directories: ['leases', 'reader-state'], single_writer_rules: ['Immutable record IDs may be created once.', 'Lease views require observed-digest compare-and-swap.', 'Reader state is owned by the reader and never mutates a message.'], retention: 'append-only unless an owner-approved privacy policy requires a separately audited tombstone procedure' });
    for (const name of ['messages', 'acknowledgements', 'goals', 'events', 'usage', 'branches']) put(`.nx-profile/ops/${name}/index.json`, { ...common, records: [] });
    put('.nx-profile/ops/leases/index.json', { ...common, current: [] });
    put('.nx-profile/ops/reader-state/index.json', { ...common, readers: [] });
    put('.nx-profile/external-channels.json', { ...common, channels: [], automatic_creation: false });
  }
  return { status: 'MATERIALIZED_PROPOSAL', files: files.sort(), persistent: true };
}

function enrollAgent(root, request) {
  assertSafeContent(request);
  assert(request.authority_ref, 'enrollment_authority_required');
  assert(!request.inherited_identity && !request.inherited_memory, 'identity_or_memory_inheritance_prohibited');
  assert(request.agent_id && /^[A-Za-z0-9_.-]+$/.test(request.agent_id), 'agent_id_invalid');
  assert(request.runtime_adapter, 'runtime_adapter_required');
  assert(Array.isArray(request.enrollments) && request.enrollments.length > 0, 'project_enrollment_required');
  const registryPath = path.join(root, '.nx-profile', 'control', 'agent-registry.json');
  assert(fs.existsSync(registryPath), 'control_registry_missing');
  const registry = readJson(registryPath);
  const record = { agent_id: request.agent_id, runtime_adapter: request.runtime_adapter, status: 'active', enrollments: request.enrollments.map((item) => item.enrollment_id), created_at: request.created_at || new Date().toISOString() };
  const existing = registry.agents.find((item) => item.agent_id === request.agent_id);
  if (existing) {
    assert(stableStringify(existing) === stableStringify(record), 'agent_identity_collision');
    return { status: 'IDEMPOTENT', agent: existing };
  }
  const projectPath = path.join(root, '.nx-profile', 'control', 'projects.json');
  const projects = readJson(projectPath);
  for (const enrollment of request.enrollments) {
    assert(enrollment.agent_id === request.agent_id, 'enrollment_agent_mismatch');
    assert(enrollment.authority_reference, 'enrollment_authority_required');
    assert(!projects.projects.some((item) => item.enrollment_id === enrollment.enrollment_id), 'enrollment_id_collision');
    projects.projects.push(enrollment);
  }
  registry.agents.push(record);
  registry.agents.sort((left, right) => left.agent_id.localeCompare(right.agent_id));
  projects.projects.sort((left, right) => left.enrollment_id.localeCompare(right.enrollment_id));
  writeJson(registryPath, registry);
  writeJson(projectPath, projects);
  return { status: 'ENROLLED', agent: record };
}

function immutablePath(root, kind, id) {
  assert(/^[A-Za-z0-9_.-]+$/.test(kind), 'record_kind_invalid');
  assert(/^[A-Za-z0-9_.-]+$/.test(id), 'record_id_invalid');
  return path.join(root, '.nx-profile', 'ops', kind, `${id}.json`);
}

function publishImmutable(root, kind, id, record) {
  assertSafeContent(record);
  const filePath = immutablePath(root, kind, id);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const content = prettyJson(record);
  try {
    const descriptor = fs.openSync(filePath, 'wx');
    try { fs.writeFileSync(descriptor, content, 'utf8'); } finally { fs.closeSync(descriptor); }
    return { status: 'CREATED', path: filePath };
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    assert(fs.readFileSync(filePath, 'utf8') === content, 'immutable_record_collision', { kind, id });
    return { status: 'IDEMPOTENT', path: filePath };
  }
}

function leaseFile(root, resourceId) {
  return path.join(root, '.nx-profile', 'ops', 'leases', `${sha256(resourceId)}.json`);
}

function acquireLease(root, request, now = new Date()) {
  assertSafeContent(request);
  assert(request.resource_id && request.owner_agent && request.goal_id, 'lease_request_incomplete');
  const ttl = Number(request.ttl_seconds || 900);
  assert(Number.isInteger(ttl) && ttl >= 1 && ttl <= 86400, 'lease_ttl_invalid');
  const filePath = leaseFile(root, request.resource_id);
  const exists = fs.existsSync(filePath);
  const currentText = exists ? fs.readFileSync(filePath, 'utf8') : null;
  const currentDigest = currentText === null ? null : sha256(currentText);
  assert(request.observed_digest === currentDigest, 'lease_compare_and_swap_lost', { observed: request.observed_digest, current: currentDigest });
  const current = currentText ? JSON.parse(currentText) : null;
  if (current?.state === 'active' && Date.parse(current.expires_at) > now.valueOf()) {
    if (current.owner_agent === request.owner_agent && current.goal_id === request.goal_id) return { status: 'ALREADY_HELD', lease: current, digest: currentDigest };
    throw new ProfileError('lease_busy', { owner: current.owner_agent, expires_at: current.expires_at });
  }
  const lease = {
    schema_version: '1.0.0', resource_id: request.resource_id,
    lease_id: deterministicId('lease', { ...request, now: now.toISOString() }), owner_agent: request.owner_agent, goal_id: request.goal_id,
    generation: (current?.generation || 0) + 1, observed_digest: currentDigest,
    acquired_at: now.toISOString(), expires_at: new Date(now.valueOf() + ttl * 1000).toISOString(), state: 'active'
  };
  writeJson(filePath, lease);
  return { status: 'ACQUIRED', lease, digest: sha256(fs.readFileSync(filePath)) };
}

function releaseLease(root, request, now = new Date()) {
  assertSafeContent(request);
  const filePath = leaseFile(root, request.resource_id);
  assert(fs.existsSync(filePath), 'lease_missing');
  const currentText = fs.readFileSync(filePath, 'utf8');
  const currentDigest = sha256(currentText);
  assert(currentDigest === request.observed_digest, 'lease_compare_and_swap_lost');
  const lease = JSON.parse(currentText);
  assert(lease.owner_agent === request.owner_agent && lease.lease_id === request.lease_id, 'lease_release_denied');
  lease.state = 'released';
  lease.expires_at = now.toISOString();
  writeJson(filePath, lease);
  return { status: 'RELEASED', lease, digest: sha256(fs.readFileSync(filePath)) };
}

function renewLease(root, request, now = new Date()) {
  assertSafeContent(request);
  const filePath = leaseFile(root, request.resource_id);
  assert(fs.existsSync(filePath), 'lease_missing');
  const currentText = fs.readFileSync(filePath, 'utf8');
  const currentDigest = sha256(currentText);
  assert(currentDigest === request.observed_digest, 'lease_compare_and_swap_lost');
  const lease = JSON.parse(currentText);
  assert(lease.state === 'active' && Date.parse(lease.expires_at) > now.valueOf(), 'lease_not_renewable');
  assert(lease.owner_agent === request.owner_agent && lease.lease_id === request.lease_id, 'lease_renewal_denied');
  const ttl = Number(request.ttl_seconds || 900);
  assert(Number.isInteger(ttl) && ttl >= 1 && ttl <= 86400, 'lease_ttl_invalid');
  lease.generation += 1;
  lease.observed_digest = currentDigest;
  lease.expires_at = new Date(now.valueOf() + ttl * 1000).toISOString();
  writeJson(filePath, lease);
  return { status: 'RENEWED', lease, digest: sha256(fs.readFileSync(filePath)) };
}

function expireLease(root, request, now = new Date()) {
  assertSafeContent(request);
  const filePath = leaseFile(root, request.resource_id);
  assert(fs.existsSync(filePath), 'lease_missing');
  const currentText = fs.readFileSync(filePath, 'utf8');
  const currentDigest = sha256(currentText);
  assert(currentDigest === request.observed_digest, 'lease_compare_and_swap_lost');
  const lease = JSON.parse(currentText);
  assert(lease.state === 'active' && Date.parse(lease.expires_at) <= now.valueOf(), 'lease_not_expired');
  lease.state = 'expired';
  lease.observed_digest = currentDigest;
  writeJson(filePath, lease);
  return { status: 'EXPIRED', lease, digest: sha256(fs.readFileSync(filePath)) };
}

function updateReaderState(root, request) {
  const statePath = path.join(root, '.nx-profile', 'ops', 'reader-state', `${sha256(`${request.reader_id}:${request.stream_id}`)}.json`);
  const state = fs.existsSync(statePath) ? readJson(statePath) : { schema_version: '1.0.0', reader_id: request.reader_id, stream_id: request.stream_id, last_seen_id: null, seen_digests: [], updated_at: request.updated_at };
  if (!state.seen_digests.includes(request.record_digest)) state.seen_digests.push(request.record_digest);
  state.seen_digests.sort();
  state.last_seen_id = request.record_id;
  state.updated_at = request.updated_at;
  writeJson(statePath, state);
  return state;
}

function validateCapabilityDeclaration(declaration) {
  assertSafeContent(declaration);
  for (const [capability, claim] of Object.entries(declaration.capabilities || {})) {
    if (claim.state === 'GO') assert(['technically-granted', 'standing-human-authorized', 'temporarily-human-authorized', 'observed'].includes(claim.authority), 'self_granted_capability', { capability });
    assert(claim.evidence && claim.evidence !== 'none', 'capability_evidence_required', { capability });
  }
  return declaration;
}

function assertChannelWrite(channel, actor) {
  assert(channel.single_writer === true, 'external_channel_not_single_writer');
  assert(actor === channel.publisher_owner, 'cross_owner_write_prohibited');
}

function proposeExternalMessage(channel, goal, actor, message) {
  assertChannelWrite(channel, actor);
  assert(Array.isArray(goal.external_authority) && goal.external_authority.includes(`publish:${channel.channel_id}`), 'external_message_goal_authority_required');
  assertSafeContent(message);
  assert(/^[a-f0-9]{40}$/.test(message.source_commit || ''), 'external_message_exact_commit_required');
  assert(/^[a-f0-9]{64}$/.test(message.content_digest || ''), 'external_message_digest_required');
  assert(message.source_path && message.message_id && message.protocol_version, 'external_message_reference_incomplete');
  assert(!Object.keys(message).some((key) => /internal|usage|lease|reader_state|private_operations/i.test(key)), 'private_operations_in_external_message');
  return { status: 'PROPOSED', channel_id: channel.channel_id, message };
}

function acknowledgeInternalMessage(root, acknowledgement) {
  const messagePath = immutablePath(root, 'messages', acknowledgement.message_id);
  assert(fs.existsSync(messagePath), 'fabricated_acknowledgement_source_missing');
  return publishImmutable(root, 'acknowledgements', acknowledgement.ack_id, acknowledgement);
}

export {
  CREDENTIAL_PATTERNS, ProfileError, REPOSITORY_FUNCTIONS, acquireLease, assert, assertEmptyDestination, assertSafeContent, assertSchema,
  acknowledgeInternalMessage, assertChannelWrite, buildProvisioningProposal, deterministicId, enrollAgent, expireLease, materializeProfile, parseArgs, prettyJson, proposeExternalMessage, publishImmutable,
  readJson, releaseLease, renewLease, sha256, stableStringify, updateReaderState, validateCapabilityDeclaration, validateSchema, writeJson
};
