# NX Environment Profiles

**PeopleBot / NX framework:** [PeopleBot](https://peoplebot.me/) · [NX Communications](https://github.com/normsexchange-dev/nx-codex-communications_dev) · **NX Environment Profiles** · [NX Agent Blueprints](https://github.com/normsexchange-dev/nx-agent-blueprints_dev)

NX Environment Profiles describes what an AI environment needs to persist safely, coordinate work, recover state, and report its real runtime capabilities. It publishes sanitized, vendor-neutral operating contracts after truthful genesis and before runtime adapters, agent families, missions, and bounded goals.

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

Long-running multi-agent environments may propose `persistent-multi-agent`, but provisioning is never silent and always stops at the declared authority boundary.

## Released 1.0 logical repository functions

| Function | Default name | Purpose |
|---|---|---|
| `nx-agent-control` | `nx-agent-control` | Constitution, registry, projects, enrollments, capabilities, and adapters |
| `nx-agent-ops` | `nx-agent-ops` | Private immutable operations and mutable CAS lease views |
| `nx-communications` | `nx-communications` | Sanitized genesis, interoperability, and external-channel protocol |
| `nx-to-recipient` | `nx-to-<recipient>` | Optional publisher-owned pairwise outbound channel |

The 1.1 candidate adds `nx-message-store` with `nx-msg-<publisher-environment-id>-<group-id>` naming for publisher-owned group correspondence. It is parallel and additive: released `nx-to-recipient` mappings remain recognizable and are not renamed in place.

Legacy Codex names remain valid through explicit compatibility mapping: `ai-agent-control` maps to `nx-agent-control`, `ai-agent-ops` maps to `nx-agent-ops`, and `nx-codex-communications_dev` maps to `nx-communications`. This profile requires no rename or forced migration.

## 1.1 development candidate

The unreleased 1.1 candidate classifies an installed runtime from evidence instead of its vendor name. It distinguishes `session-only`, `interactive-tool`, `persistent-execution`, and `continuous-service` using observed filesystem, Git, durable persistence, between-turn execution, service supervision, and credential-custody capabilities. Automatic model execution remains a separate, disabled authority boundary.

It also stages the local recovery contract for Communications 0.8 publisher-owned group message stores while preserving `nx-to-recipient` for released 0.7 pairwise channels. The stable `VERSION` remains `1.0.0`; no `environment-profiles-v1.1.0` tag or Communications 0.8 dependency is claimed to exist. See `docs/CAPABILITY_EVIDENCE_AND_EXECUTION_CLASSES_dev.md` and `docs/MESSAGE_STORE_RECOVERY_dev.md`.

## Deterministic use

```text
node scripts/plan-provisioning.mjs --request fixtures/provisioning-request.example.json --output <proposal.json>
node scripts/materialize-profile.mjs --proposal <proposal.json> --output <empty-directory>
node scripts/enroll-agent.mjs --root <materialized-directory> --request fixtures/enrollment-request-agent-a.json
node scripts/validate-profile.mjs
node --test tests/*.test.mjs
```

The planner is dry-run by default. `--apply` marks an explicitly authorized proposal for a separate provider implementation; this repository never calls GitHub, creates repositories, installs credentials, or activates an agent.

All fixtures are fictional. Public artifacts contain no live destination-agent identity, operational record, credential, customer or business data, or raw conversation. The only real repository identities and release anchors are the publisher and compatibility references explicitly required by this standard.
