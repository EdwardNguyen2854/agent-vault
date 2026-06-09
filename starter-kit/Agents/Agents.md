---
title: Agents
type: folder-note
tags: [agents, folder-note]
---

# Agents

Agent profiles live under `Agents/Profiles/`. Shared user context, memory, rules, skills, and tools live under `Agents/Shared/`, `Agents/Skills/`, and `Agents/Tools/`.

## Active Agents

- [[Agents/Profiles/Obra/SOUL|Obra]] - knowledge management
- [[Agents/Profiles/Nora/SOUL|Nora]] - automation and MCP support

## Adding A New Agent

1. Create a folder under `Agents/Profiles/`, for example `Agents/Profiles/MyAgent/`.
2. Add `SOUL.md` with `type: agent` in its frontmatter.
3. Add optional profile memory in `MEMORY.md`.
4. Add reusable capabilities to `Agents/Skills/` and `Agents/Tools/` so every agent can use them.
5. Link the new agent from this index so it shows up in the Agents view and graph.
