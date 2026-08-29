# Runtime adapter contract

A runtime adapter translates the neutral profile into one runtime's instruction discovery, filesystem, Git, secure GitHub, persistence, scheduling, activation, subagent, inbox/event, secret, and deployment surfaces. It does not redefine policy or claim capabilities merely because the profile names them.

Every adapter exposes the same semantic fields and one of `GO`, `CONDITIONAL`, `DEGRADED`, `NO-GO`, or `UNKNOWN`, with a mechanism and evidence string. Runtime preflight is authoritative for a live execution. Static adapters are portability declarations, not live health checks.

Included adapters cover OpenAI Codex, Gemini CLI, Google AI Studio, Claude Code, GitHub Copilot where supported, a generic local runtime, and a future/unknown template. They preserve identical repository functions, identity rules, message/lease semantics, authority stops, privacy boundaries, and external-channel ownership.

Unsupported or unverified behavior remains `UNKNOWN` or blocked. A scheduler or deployed application may activate a runtime, but a chat prompt is not a continuous agent. Deployment is always a separate external mutation.
