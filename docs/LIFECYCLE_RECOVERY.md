# Lifecycle, upgrade, drift, rollback, recovery, and deprovisioning

## Versions and lifecycle

Profile versions use semantic versioning. A stable release is an exact annotated tag; mutable `main` is development state, never release authority. Patch versions preserve compatible semantics, minor versions add backward-compatible features, and major versions may change required behavior. Releases move through experimental, stable, deprecated, and retired states without rewriting history.

## Upgrade and drift

An environment compares its pinned profile manifest, annotated tag object/target, materialized file digests, backend contract, repository-function bindings, and adapter declaration. Adoption is an explicit owner decision recorded separately. A verifier reports interface drift, local sovereign specialization, capability evidence, credential review, repository access, and service health as different dimensions.

Upgrades never replace identities, operations history, existing repositories, or application state. Existing agents may remain on a known-good release, adopt, defer, fork, or specialize.

## Rollback and recovery

Rollback resolves the exact previous annotated tag and target in an isolated checkout, regenerates only managed profile artifacts, and preserves all immutable operations. The initial known-good Codex anchors are recorded in `release/rollback-anchors.json`. Remembered text, `latest`, and mutable branches are prohibited rollback sources.

Partial provisioning recovers by exact discovery and proposal comparison. Matching created repositories are reused; missing approved repositories remain pending; unrelated repositories stop the process. Interrupted operations resume from immutable records and current lease generations.

## Deprovisioning

Deprovisioning is never implicit. First suspend new goals, external publication, schedulers, and enrollment. Revoke credentials through the provider. Release leases. Export owner-approved audit summaries without raw conversations or secrets. Archive or remove repositories only under separate explicit owner authority and retention policy. Preserve immutable release provenance and document what remains unavailable afterward.
