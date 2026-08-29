# Google AI Studio capability assessment

Assessment date: 2026-08-29. Google AI Studio is evaluated separately from Gemini CLI.

| Capability | State | Assessment |
|---|---|---|
| Instruction loading | `DEGRADED` | AI Studio chat supports saved system instructions. Build mode documentation does not establish automatic repository-wide `AGENTS.md` or `GEMINI.md` loading. |
| Filesystem | `DEGRADED` | Build mode manages a multi-file application in a hosted development container. General host filesystem access suitable for a sovereign control checkout is not documented. |
| Git | `DEGRADED` | GitHub import and two-way sync are documented, but a general Git CLI, branch-ownership enforcement, and lease executor are not. |
| Secure GitHub connection | `CONDITIONAL` | Settings can link/import repositories. Exact installation permissions and least-privilege suitability require owner review before governed use. |
| Persistent application storage | `CONDITIONAL` | Code persists through AI Studio/GitHub. Full-stack apps may use network storage or Firebase. Application state is not automatically authoritative operations state. |
| Background scheduling | `UNKNOWN` | No native Build-mode persistent-agent scheduler was verified. A separately authorized deployed service or external scheduler would be required. |
| Cross-prompt activation | `UNKNOWN` | No independent activation mechanism across saved prompts was verified. |
| Subagents | `UNKNOWN` | The Build agent manages multiple files; a governed, user-configurable multi-agent/subagent interface was not verified. |
| Inbox polling/events | `NO-GO` | No native persistent inbox/event loop was verified. A separate service would be required. |
| Secret storage | `CONDITIONAL` | Build mode documents server-side application Secrets, including `GEMINI_API_KEY`. Repository credentials still require a separately reviewed least-privilege secret boundary. |
| Deployment | `CONDITIONAL` | Publishing creates a separate Cloud Run service. That is a protected external mutation and this profile performs none. |

Official sources:

- https://ai.google.dev/gemini-api/docs/ai-studio-quickstart
- https://ai.google.dev/gemini-api/docs/aistudio-build-mode
- https://ai.google.dev/gemini-api/docs/aistudio-fullstack
- https://ai.google.dev/gemini-api/docs/aistudio-deploying

The absence of verified scheduling, cross-prompt activation, subagents, or inbox polling is not simulated as operational support. Static profile compatibility can still be documented while live persistent operation remains unavailable.
