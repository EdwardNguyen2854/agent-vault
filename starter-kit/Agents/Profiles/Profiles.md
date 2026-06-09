---
title: Profiles
type: folder-note
tags: [agents, folder-note, profiles]
---

# Profiles

This index introduces the agents defined under `Agents/Profiles/`. Each agent has a `SOUL.md` describing its role and principles, an optional `MEMORY.md` for durable context, and a `config.yaml` for settings.

## Active Agents

- [[Agents/Profiles/Obra/SOUL|Obra]] - Knowledge Curator. Focuses on vault structure, tagging conventions, backlink health, and discoverability.
- [[Agents/Profiles/Nora/SOUL|Nora]] - Automation Engineer. Focuses on workflow automation, MCP integration, and safe automation design.

## Adding A New Agent

1. Create a folder under `Agents/Profiles/`, for example `Agents/Profiles/MyAgent/`.
2. Add `SOUL.md` with `type: agent` in its frontmatter.
3. Add optional profile memory in `MEMORY.md`.
4. Add settings to `config.yaml` if the agent needs configuration.
5. Link the new agent from this index so it shows up in the Agents view and graph.

## Related

- [[Agents/AGENTS]] - parent index
- [[Agents/Skills/SKILLS]] - shared capabilities
- [[Agents/Tools/TOOLS]] - shared tools
- [[Agents/Shared/USER]] - shared user context
- [[Agents/Shared/RULES]] - shared rules
