# Provisioning and enrollment

## Discovery and proposal

1. Verify truthful genesis and the environment owner.
2. Select one mode.
3. Discover existing logical functions by exact owner/repository identity.
4. Refuse duplicate provisioning when an environment already exists; use `enroll-existing`.
5. Generate an exact dry-run proposal containing the owner, environment ID, repository names/functions/visibility/data classes, requested permissions, credential mechanism, external effects, manual alternative, and unavailable features.
6. Stop for owner authority before repository creation, connection, visibility changes, or permission grants.
7. A separate provider implementation may consume an apply-marked proposal only after rechecking its digest and authority.
8. Verify every resulting repository deterministically and record adoption without overwriting unrelated state.

The included planner makes no network request. `--apply` changes only the proposal's declared boundary; it does not create a repository. This keeps planning testable and prevents silent side effects.

## GitHub backend

Use normal OAuth/device authentication for attended work or a selected-repository GitHub App with minimum permissions and short-lived tokens for unattended services. Never enter or store credentials in prompts, chat, source, Git, logs, messages, exports, browser storage, or model memory.

Genesis stores are empty. Repositories use an integration branch plus one owner-shaped task branch per active goal. Protect integration branches where supported. Never force-push. Refuse to overwrite an unrelated repository. A partial run is recovered by rediscovery: exact matches are reused, missing approved functions remain proposed, and conflicting identities stop.

External outbound repositories are never created automatically. They require an exact publisher owner, recipient owner, repository, visibility, protocol, and message-authority boundary.

## Enrollment

Enrollment requires a distinct agent ID, runtime adapter, explicit project-scoped roles, repository/branch bindings, and an owner authority reference. An agent may have several project enrollments. Enrollment is idempotent only for an identical record; an identity collision stops. It copies no parent identity, credential, capability grant, mission, goal, or private memory.

Agent-family adoption is separate and cannot satisfy enrollment authority. Mission activation and external action are later, separately authorized steps.
