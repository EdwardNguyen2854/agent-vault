---
name: backlink-review
description: Analyze and improve note connections. Use when reviewing backlinks, finding orphan notes, checking link health, or improving note connectivity. Make sure to use this skill whenever the user mentions backlinks, links, orphan notes, link health, or note connections.
tags: [knowledge-management, backlinks, links, graph, connectivity]
status: active
author: Obra
tools: []
memory: []
---

# Backlink Review

Analyze and improve the connections between notes.

## When to Use

This skill activates when:

- User asks to review backlink health
- Finding orphan notes (no incoming/outgoing links)
- Checking for broken links
- Improving note connectivity

## Workflow

### 1. Find Orphan Notes

- Notes with no incoming links
- Notes with no outgoing links
- Identify isolated clusters

### 2. Check Link Validity

- Verify links point to existing notes
- Find broken or dead links
- Identify one-way links that should be bidirectional

### 3. Suggest Connections

- Add links where related knowledge exists
- Create index notes for clusters
- Improve contextual linking

## Output Format

```markdown
## Backlink Health Report

### Orphan Notes (no incoming links)

- [[Note A]] - consider linking from [[Related Note B]]
- [[Note C]]

### Broken Links

- [[Note X]] → links to missing [[Non-existent]]

### Link Opportunities

- [[Note D]] and [[Note E]] share topic X, consider linking
```

## Link Metrics

| Metric              | Description            | Target |
| ------------------- | ---------------------- | ------ |
| Link density        | Average links per note | 2-5    |
| Orphan rate         | Notes with no links    | < 10%  |
| Bidirectional ratio | Links that are mutual  | > 30%  |

## Principles

1. **Link organically** - don't force links
2. **Context matters** - links should add meaning
3. **Bidirectional where appropriate** - related notes should link both ways
