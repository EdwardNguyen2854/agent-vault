# Markdown Conventions

Agent Vault supports standard GitHub-flavored markdown with additional conventions for wiki links, tags, tasks, and agent profiles.

## Wiki Links

```markdown
See [[Launch Plan]] for the project schedule.
See [[Launch Plan|the launch plan]] for a readable alias.
See [[Launch Plan#Milestones]] for a heading-specific reference.
```

Links resolve against note title, file name, path without extension, or full path. Unresolved targets are surfaced as missing nodes in the graph and counted as broken links on the dashboard.

## Tags

### Frontmatter tags

```markdown
---
tags: [project, research]
---
```

### Inline tags

```markdown
# Launch Plan

This note is part of #agent-vault and #release.
```

Tags support letters, numbers, underscores, slashes, and hyphens.

## Tasks

```markdown
- [ ] Draft release notes due:2026-06-14 @nora #release
- [x] Review [[Agent Vault MVP]]
```

The Tasks view aggregates tasks from every note, filters active or completed work, supports search, and toggles completion back to the source markdown when the vault is writable.

Recognized task metadata: `due:YYYY-MM-DD`, `@assignee`, `#tag`.

## Frontmatter

```markdown
---
title: Launch Plan
tags: [project, launch]
status: active
type: agent
role: researcher
model: DeepSeek V4
---
```

The parser is intentionally lightweight. Complex YAML features such as nested objects, multiline strings, and advanced quoting are not supported yet. Legacy agent `skills` and `tools` arrays may be displayed as descriptive metadata, but they do not restrict access to shared skills or tools.

## Executable Agent Skills

Executable skills use the Agent Skills package layout:

```text
Agents/
  Skills/
    literature-review/
      SKILL.md
      references/
      scripts/
      assets/
```

`SKILL.md` must include `name` and `description` frontmatter. The `name` must be lowercase, hyphenated, 64 characters or fewer, and match the parent folder name.

```markdown
---
name: literature-review
description: Use when researching, comparing sources, or drafting a literature review.
---

# Literature Review

Read the selected sources, compare claims, track citations, and produce a concise synthesis.
```

Agent Vault treats `SKILLS.md` files as index notes only. Legacy root-level `Skills/<skill-name>/SKILL.md` packages are still supported. Flat notes marked `type: skill` remain browseable vault knowledge, but they are not executable skills and are not auto-routed in chat until packaged as `<skill-name>/SKILL.md`.
