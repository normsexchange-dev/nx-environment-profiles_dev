# Migration and compatibility

Existing Codex repositories and agents remain valid. The compatibility layer maps legacy names to neutral functions without renaming repositories:

- `ai-agent-control` → `nx-agent-control`
- `ai-agent-ops` → `nx-agent-ops`
- `nx-codex-communications_dev` → `nx-communications`

Existing operations history, identity, project enrollments, branches, and release tags remain untouched. No forced migration is required. A consumer may compare its logical functions to the profile and record adoption, rejection, deferral, fork, or specialization.

A clean environment materializes empty registries and stores and inherits no Codex identity or private operations. A third agent discovers the existing environment and uses `enroll-existing`; it does not create duplicate repositories. A foreign environment remains sovereign and may adopt or diverge without Norms control over its internal state.

Communications/genesis, this operating profile, runtime adapters, agent families, missions, and goals keep independent versions and authority. Compatibility between them is recorded explicitly and never inferred from mutable `main`.
