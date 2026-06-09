---
name: safe-automation-design
description: Design automations with proper safety considerations. Use when designing automations, planning safety gates, implementing confirmations, or building reversible systems. Make sure to use this skill whenever the user mentions safety, confirmations, rollback, or safe automation.
tags: [automation, safety, security, design]
status: active
author: Nora
tools: []
memory: []
---

# Safe Automation Design

Design automations with proper safety considerations.

## When to Use

This skill activates when:

- User asks about automation safety
- Designing confirmation gates
- Planning rollback procedures
- Building systems that need reversibility

## Workflow

### 1. Identify Destructive Operations

- Delete, overwrite, send data
- Operations with irreversible effects
- Actions requiring human judgment

### 2. Design Confirmation Gates

- Require explicit human approval
- Provide clear consequences
- Allow cancellation at each step

### 3. Plan for Failure

- What happens if automation fails mid-process?
- Leave system in consistent state
- Implement compensating transactions

### 4. Add Logging

- Track what automation did and when
- Record inputs and outputs
- Enable audit trail

### 5. Build Rollback Capability

- Can changes be undone?
- Document rollback procedures
- Test rollback scenarios

## Safety Checklist

## Principles

1. **Safety first** - never skip confirmation for destructive actions
2. **Plan for failure** - assume things will break
3. **Keep it reversible** - prefer idempotent operations
4. **Log everything** - you can't debug what you can't see
