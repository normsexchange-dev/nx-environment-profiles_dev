# NX Environment Profiles

NX Environment Profiles publishes sanitized, vendor-neutral operating contracts for sovereign AI environments. It sits after truthful genesis and before runtime adapters, agent families, missions, and bounded goals.

The initial stable profile is `persistent-multi-agent-github` version `1.0.0`, released only by the annotated tag `environment-profiles-v1.0.0`. It defines logical functions and deterministic local tooling; it is not a hosted control plane and grants no repository, credential, messaging, outreach, commerce, deployment, or application authority.

## Layering

1. **Autostart / genesis** establishes identity, lineage, sovereignty, and interoperability.
2. **Environment operating profile** establishes persistent registration, operations, messages, goals, leases, events, usage summaries, recovery, and channel contracts.
3. **Runtime adapter** reports how a runtime discovers instructions and supplies capabilities without redefining policy.
4. **Agent family** supplies reusable job knowledge and evaluations without infrastructure authority.
5. **Mission** supplies standing authorized purpose.
6. **Goal** supplies bounded current work and external authority.

## Supported environment modes

- `session-only`: no persistent infrastructure.
- `persistent-single-agent`: durable identity and audit state without multi-agent coordination claims.
- `persistent-multi-agent`: full registry, operations, goals, compare-and-swap leases, internal messaging, events, usage, and optional external-channel support.
- `enroll-existing`: enroll a distinct identity into an already provisioned environment without duplicating repositories.

Norms-controlled long-running environments should propose `persistent-multi-agent`, but provisioning is never silent and always stops at the declared authority boundary.

## Logical repository functions

| Function | Default name | Purpose |
|---|---|---|
| `nx-agent-control` | `nx-agent-control` | Constitution, registry, projects, enrollments, capabilities, and adapters |
| `nx-agent-ops` | `nx-agent-ops` | Private immutable operations and mutable CAS lease views |
| `nx-communications` | `nx-communications` | Sanitized genesis, interoperability, and external-channel protocol |
| `nx-to-recipient` | `nx-to-<recipient>` | Optional publisher-owned pairwise outbound channel |

Legacy Codex names remain valid through explicit compatibility mapping: `ai-agent-control` maps to `nx-agent-control`, `ai-agent-ops` maps to `nx-agent-ops`, and `nx-codex-communications_dev` maps to `nx-communications`. This profile requires no rename or forced migration.

## Deterministic use

```text
node scripts/plan-provisioning.mjs --request fixtures/provisioning-request.example.json --output <proposal.json>
node scripts/materialize-profile.mjs --proposal <proposal.json> --output <empty-directory>
node scripts/enroll-agent.mjs --root <materialized-directory> --request fixtures/enrollment-request.example.json
node scripts/validate-profile.mjs --branch main
node --test tests/*.test.mjs
```

The planner is dry-run by default. `--apply` marks an explicitly authorized proposal for a separate provider implementation; this repository never calls GitHub, creates repositories, installs credentials, or activates an agent.

All fixtures are fictional. Public artifacts contain no live identities, messages, usage, private topology, credentials, customer data, business records, or raw conversations.
