---
name: tag-cleanup
description: Audit, standardize, and improve tag systems. Use when cleaning up tags, creating tag hierarchies, removing orphan tags, or establishing tagging conventions. Make sure to use this skill whenever the user mentions tags, tagging conventions, tag cleanup, or tag hierarchy.
tags: [knowledge-management, tags, taxonomy, organization]
status: active
author: Obra
tools: []
memory: []
---

# Tag Cleanup

Audit and standardize tag systems for better discoverability.

## When to Use

This skill activates when:

- User asks about tag cleanup or standardization
- Discussing tagging conventions
- Creating tag hierarchies
- Finding orphan or duplicate tags

## Workflow

### 1. Audit Current Tags

- List all unique tags and count usage
- Identify tag clusters (tags used together)
- Find orphan tags (used only once)

### 2. Propose Hierarchy

- Create parent tags with specific children
- Example: `project/startup`, `project/ongoing`
- Remove redundant or overlapping tags

### 3. Document Conventions

- Create tag guidelines
- Include approved tag list
- Document when to use each tag

## Tag Hierarchy Example

```
project/
  project/startup
  project/ongoing
  project/completed
area/
  area/technical
  area/business
status/
  status/blocked
  status/review
```

## Principles

1. **Broad to specific**: `project` → `project/startup` → `project/startup/phase1`
2. **Mutually exclusive**: Don't tag with both `project` and `status/done`
3. **Meaningful clusters**: Tags used together should relate logically
