import { assert, assertSafeContent, stableStringify } from './profile-core.mjs';

export const CANDIDATE_PROFILE_VERSION = '1.1.0';
export const EXECUTION_CLASSES = [
  'session-only', 'interactive-tool', 'persistent-execution', 'continuous-service'
];
export const RUNTIME_CAPABILITIES = [
  'filesystem', 'git', 'credential_custody', 'durable_persistence',
  'between_turn_execution', 'service_supervision'
];

function exactKeys(value, keys, label) {
  assert(value && typeof value === 'object' && !Array.isArray(value), `${label}_object_required`);
  assert(stableStringify(Object.keys(value).sort()) === stableStringify([...keys].sort()), `${label}_fields_invalid`);
}

function dateTime(value, code, nullable = false) {
  if (nullable && value === null) return;
  assert(typeof value === 'string' && Number.isFinite(Date.parse(value)), code);
}

export function validateRuntimeCapabilityDeclaration(declaration) {
  assertSafeContent(declaration);
  exactKeys(declaration, [
    '$schema', 'schema_version', 'environment_id', 'runtime_id', 'assessed_at',
    'claimed_execution_class', 'automatic_model_execution', 'capabilities'
  ], 'runtime_capability_declaration');
  assert(declaration.$schema === 'https://raw.githubusercontent.com/normsexchange-dev/nx-environment-profiles_dev/environment-profiles-v1.1.0/schemas/runtime-capability-profile.schema.json', 'runtime_capability_schema_identity_invalid');
  assert(declaration.schema_version === CANDIDATE_PROFILE_VERSION, 'runtime_capability_schema_version_invalid');
  assert(typeof declaration.environment_id === 'string' && declaration.environment_id.length > 0, 'runtime_capability_environment_invalid');
  assert(typeof declaration.runtime_id === 'string' && declaration.runtime_id.length > 0, 'runtime_capability_runtime_invalid');
  dateTime(declaration.assessed_at, 'runtime_capability_assessed_at_invalid');
  assert(EXECUTION_CLASSES.includes(declaration.claimed_execution_class), 'runtime_execution_class_invalid');
  exactKeys(declaration.automatic_model_execution, ['enabled', 'authority_reference'], 'runtime_automatic_model_execution');
  assert(typeof declaration.automatic_model_execution.enabled === 'boolean', 'runtime_automatic_model_execution_invalid');
  if (declaration.automatic_model_execution.enabled) {
    assert(typeof declaration.automatic_model_execution.authority_reference === 'string' && declaration.automatic_model_execution.authority_reference.trim(), 'runtime_automatic_model_authority_required');
  } else {
    assert(declaration.automatic_model_execution.authority_reference === null, 'runtime_disabled_model_authority_must_be_null');
  }
  exactKeys(declaration.capabilities, RUNTIME_CAPABILITIES, 'runtime_capabilities');
  for (const [name, capability] of Object.entries(declaration.capabilities)) {
    exactKeys(capability, ['status', 'mechanism', 'evidence', 'observed_at', 'expires_at'], `runtime_capability_${name}`);
    assert(['GO', 'DEGRADED', 'NO-GO', 'UNKNOWN', 'CONDITIONAL'].includes(capability.status), 'runtime_capability_status_invalid');
    assert(typeof capability.mechanism === 'string' && capability.mechanism.trim(), 'runtime_capability_mechanism_invalid');
    assert(typeof capability.evidence === 'string' && capability.evidence.trim() && capability.evidence.toLowerCase() !== 'none', 'runtime_capability_evidence_required');
    dateTime(capability.observed_at, 'runtime_capability_observed_at_invalid');
    dateTime(capability.expires_at, 'runtime_capability_expires_at_invalid', true);
    if (capability.expires_at !== null) assert(Date.parse(capability.expires_at) >= Date.parse(capability.observed_at), 'runtime_capability_evidence_expired_before_observation');
  }
  if (declaration.claimed_execution_class === 'session-only') {
    for (const key of ['credential_custody', 'between_turn_execution', 'service_supervision']) {
      assert(declaration.capabilities[key].status !== 'GO', 'session_only_persistent_capability_claim');
    }
  }
  return declaration;
}

export function classifyExecution(declaration) {
  validateRuntimeCapabilityDeclaration(declaration);
  const go = (key) => declaration.capabilities[key].status === 'GO';
  let computed = 'session-only';
  if (go('filesystem') || go('git') || go('durable_persistence')) computed = 'interactive-tool';
  if (go('filesystem') && go('git') && go('durable_persistence') && go('between_turn_execution')) computed = 'persistent-execution';
  if (computed === 'persistent-execution' && go('service_supervision')) computed = 'continuous-service';
  const claimedRank = EXECUTION_CLASSES.indexOf(declaration.claimed_execution_class);
  const computedRank = EXECUTION_CLASSES.indexOf(computed);
  const status = claimedRank === computedRank
    ? 'VERIFIED'
    : claimedRank > computedRank ? 'NO_GO_OVERCLAIM' : 'DEGRADED_UNDERCLAIM';
  return {
    status, claimed_execution_class: declaration.claimed_execution_class,
    computed_execution_class: computed,
    automatic_model_execution_enabled: declaration.automatic_model_execution.enabled
  };
}
