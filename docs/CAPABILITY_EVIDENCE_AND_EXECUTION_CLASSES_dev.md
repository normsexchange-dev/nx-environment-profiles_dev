# Capability Evidence and Execution Classes — 1.1 Candidate

Status: unreleased development candidate. The stable profile remains `environment-profiles-v1.0.0`; no `environment-profiles-v1.1.0` tag is claimed.

Runtime family names do not prove runtime behavior. A Codex, Gemini, Claude, Copilot, local, or future adapter may occupy different execution classes in different installations. Classification follows observed capability evidence, not the vendor label.

## Execution classes

| Class | Minimum evidence-backed behavior |
|---|---|
| `session-only` | No durable or interactive tool capability has been proven. |
| `interactive-tool` | At least one of filesystem, Git, or durable persistence is proven, but between-turn execution is not fully proven. |
| `persistent-execution` | Filesystem, Git, durable persistence, and between-turn execution are all `GO`. |
| `continuous-service` | Persistent execution plus a proven service supervisor is `GO`. |

`credential_custody` is measured separately. It is required for unattended access to protected external resources, but a runtime may perform local persistent work without holding an external credential. A `GO` custody claim must identify a mechanism and evidence without containing the credential.

Every capability records status, mechanism, evidence, observation time, and optional expiry. `UNKNOWN` is a valid honest result. `GO` with `none`, self-assertion, an expired observation, or a vendor-name inference is invalid.

The candidate classifier recomputes the class. A claim above the computed class is `NO_GO_OVERCLAIM`; a conservative claim below it is `DEGRADED_UNDERCLAIM`. Neither changes authority.

## Model execution boundary

Execution class does not authorize model use. `automatic_model_execution` is a separate setting. This candidate example keeps it disabled. Enabling it later requires a separate authority reference plus the communications usage, semantic, actionability, and authority gates. The profile classifier never invokes a model.

## Platform adapters

Existing 1.0 adapter declarations remain valid and unchanged. A 1.1 migration would generate one capability record per installed environment after local probes. It must not bulk-upgrade adapter claims from documentation alone.
