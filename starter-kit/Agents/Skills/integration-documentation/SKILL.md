---
name: integration-documentation
description: Document system integrations and data flows. Use when documenting integrations, mapping data flows, creating runbooks, or explaining how systems connect. Make sure to use this skill whenever the user mentions integration documentation, data flow, runbooks, or system connections.
tags: [automation, integration, documentation, data-flow]
status: active
author: Nora
tools: []
memory: []
---

# Integration Documentation

Document system integrations and data flows.

## When to Use

This skill activates when:

- User asks to document an integration
- Mapping data flows between systems
- Creating runbooks or setup guides
- Explaining how systems connect

## Workflow

### 1. Map Data Flow

- How does data move between systems?
- What transformations occur?
- Where are the integration points?

### 2. Document Authentication

- OAuth, API keys, service accounts
- Setup requirements
- Permission scopes

### 3. Define Error Handling

- What happens when integration fails?
- Retry policies
- Alert thresholds

### 4. Document Failure Modes

- Known issues and symptoms
- Resolution procedures
- Escalation paths

### 5. Create Runbook

- Step-by-step setup
- Troubleshooting guide
- Contact information

## Documentation Template

```markdown
## Integration: [System A] ↔ [System B]

### Overview

[Brief description of what this integration does]

### Data Flow

[System A] --→ [Transform] --→ [System B]

### Authentication

- Method: OAuth 2.0 / API Key / etc.
- Setup: [Link to setup guide]

### Error Handling

| Error | Cause         | Resolution     |
| ----- | ------------- | -------------- |
| 401   | Expired token | Refresh token  |
| 429   | Rate limited  | Wait and retry |

### Failure Modes

1. **Network timeout**: Retry with exponential backoff
2. **Invalid data**: Log error, alert, skip record
```

## Principles

1. **Document like handing off** - assume someone else will maintain this
2. **Include failure modes** - plan for what happens when things break
3. **Be specific** - concrete examples over abstract descriptions
