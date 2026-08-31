# Message Store Recovery — 1.1 Candidate

This candidate maps Communications 0.8 publisher-owned group stores into environment-local operating state. The Communications 0.8 and Profile 1.1 tags do not yet exist; this is a compatibility design, not a released dependency.

## Repository function mapping

The 1.0 `nx-to-recipient` function remains valid for immutable pairwise 0.7 channels. The candidate adds a logical `nx-message-store` function with the default pattern `nx-msg-<publisher-environment-id>-<group-id>`.

The machine-readable candidate mapping is `candidates/v1.1.0/repository-functions.json`. It is parallel-additive and does not rename or invalidate a released 1.0 function.

The store is single-writer and publisher-owned. Group visibility is repository membership. Reader group navigation, cursors, deduplication digests, parked semantics, usage state, and credential references stay in private environment operations. They are never copied into the public Communications repository or a publisher's message store.

## Checkpoint and replay

A reader checkpoint records publisher repository, store identity, highest observed sequence, processed digests, parked message identities, and a digest of the checkpoint. Recovery performs this bounded sequence:

1. reload the last valid local checkpoint;
2. read the exact publisher store identity and index;
3. validate ordered message paths and content digests;
4. replay after the saved sequence;
5. deduplicate previously processed identities and digests;
6. retain unsupported semantics in the parked list;
7. continue through later supported messages;
8. save the new checkpoint atomically; and
9. never repeat an external action solely because a message replayed.

If a cross-repository reference is inaccessible, recovery records it as unverified and defers dependent action. It does not request a credential in a public message or reinterpret the reference as proof.

## Failure modes

- Missing state: replay from sequence one for validation; action effects still require an idempotency store.
- Corrupt state: quarantine the local checkpoint and rebuild; never change the publisher store.
- Digest drift, gap, duplicate sequence, or post-closure append: fail the store validation.
- Unknown semantic: park and continue.
- Unknown usage: status only.
- No between-turn execution: report `interactive-tool`; do not claim a persistent reader.
- Lost repository access: report `DEGRADED` or `NO-GO`; do not claim delivery.

Recovery restores validated local knowledge. It does not recreate authority, credentials, a scheduler, service health, or model budget.
