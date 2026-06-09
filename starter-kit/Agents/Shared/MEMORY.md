---
title: Memory
type: memory
memory_type: shared
status: active
tags: [shared, memory]
---

# Shared Memory

Team-level context that every agent should be aware of when working in this vault. Per-agent memory lives under `Agents/Profiles/<Agent>/MEMORY.md`; this file is for context that is not tied to a single agent.

## Durable Context

- This vault is the source of truth for notes, run logs, and agent identity.
- Owner profile lives in `Profile/PROFILE.md`.
- Agent identities and roles live in `Agents/Profiles/`.
- Agent run logs are written to `Shared/Runs/` as `YYYY-MM-DD - <Agent> - <Goal>.md`.
- Shared rules live in [[Agents/Shared/3-RULES]] and shared user context in [[Agents/Shared/1-USER]].

## Open Questions

- Which shared conventions are stable enough to graduate into rules?
