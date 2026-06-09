---
name: vault-health-checks
description: Perform comprehensive vault health assessments. Use when checking vault health, auditing organization, generating health reports, or assessing overall vault quality. Make sure to use this skill whenever the user mentions vault health, health checks, vault audit, or overall quality assessment.
tags: [knowledge-management, health, audit, analysis, report]
status: active
author: Obra
tools: []
memory: []
---

# Vault Health Checks

Perform comprehensive health assessments of knowledge vaults.

## When to Use

This skill activates when:

- User requests a vault health check
- Auditing organization and structure
- Generating health reports
- Assessing overall vault quality

## Workflow

### 1. Structure Audit

- Folder organization and naming
- Consistency in conventions
- Depth of nesting

### 2. Tag Analysis

- Tag usage distribution
- Orphan tags identification
- Hierarchy quality

### 3. Link Health

- Orphan notes count
- Broken links detection
- Link density assessment

### 4. Content Quality

- Notes without summaries
- Empty or stub notes
- Average note length

### 5. Naming Consistency

- Title case vs other conventions
- Date prefixes
- Status indicators

## Health Score Calculation

| Category  | Weight | Key Metrics                      |
| --------- | ------ | -------------------------------- |
| Structure | 25%    | Folder logic, naming consistency |
| Tags      | 25%    | Usage, hierarchy, orphans        |
| Links     | 25%    | Orphan rate, broken links        |
| Content   | 25%    | Summaries, note length           |

## Output Format

```markdown
## Vault Health Report

**Overall Score:** 78/100

### Structure (85/100)

- ✓ Logical folder hierarchy
- ⚠ 3 notes with inconsistent naming

### Tags (72/100)

- ⚠ 12 orphan tags found
- ✓ Good tag hierarchy

### Links (81/100)

- ⚠ 5 orphan notes
- ✓ No broken links

### Content (75/100)

- ⚠ 8 notes without summaries
- ✓ Good average note length
```

## Principles

1. **Diagnostic, not prescriptive** - propose solutions, don't mandate
2. **Prioritize impact** - focus on high-value improvements
3. **Be constructive** - frame issues as opportunities
