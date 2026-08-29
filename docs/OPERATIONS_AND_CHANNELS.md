# Internal operations and external channels

## Internal coordination

The environment-owned private operations function stores:

- immutable internal messages and separate acknowledgements;
- immutable bounded goals;
- current compare-and-swap lease views with expiry and generation;
- immutable events and normalized usage summaries;
- immutable branch/work-ownership records;
- reader-owned unread/dedup state outside message records.

Identifiers are deterministic or collision-resistant. Immutable publication creates a path once and accepts an identical retry; different content at the same path fails. Current lease views are the only protocol-mutable coordination records. Every acquisition, renewal, or release supplies the observed digest. A stale writer loses safely. Bounded retries never force-push or overwrite another owner.

Agents resume by verifying current enrollment, operations freshness, goal state, owned branch, and lease. Interrupted work keeps immutable history; an expired lease may be reacquired through a new generation after compare-and-swap verification. Drift is reported by dimension rather than hidden.

## External communication

Internal messages never use a pairwise external channel. Each external outbound repository has exactly one publisher-owner. The recipient reads exact immutable commits and paths, keeps its cursor/cache in its own environment, and responds only from its own outbound repository.

An external message pins the publisher, repository, 40-hex commit, path, message ID, digest, channel ID, and protocol version. Corrections, supersession, withdrawal, rejection, and acknowledgement are new append-only records. Transport validation does not establish delivery, business-data admission, sourcing authority, outreach authority, commerce authority, or service health.

Creating an external message requires a current goal that explicitly authorizes publication. This profile creates no actual channel or message.
