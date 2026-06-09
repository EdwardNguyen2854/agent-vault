---
name: permission-review
description: Review and design permission systems for automation. Use when reviewing permissions, designing access controls, assessing least privilege, or planning permission boundaries. Make sure to use this skill whenever the user mentions permissions, access control, least privilege, or permission boundaries.
tags: [automation, security, permissions, access-control]
status: active
author: Nora
tools: []
memory: []
---

# Permission Review

Review and design permission systems for automation.

## When to Use

This skill activates when:

- User asks about permissions for automation
- Designing access control systems
- Assessing least privilege principles
- Planning permission boundaries

## Workflow

### 1. Map Required Permissions

- What does the automation need to do?
- What resources does it access?
- What actions does it perform?

### 2. Assess Least Privilege

- Does it request only what's necessary?
- Are there overly broad permissions?
- Can we reduce scope?

### 3. Identify Sensitive Operations

- What could go wrong with these permissions?
- Data exposure risks
- Modification or deletion risks

### 4. Propose Restrictions

- Time-limited permissions
- Scope-limited access
- IP allowlists or other bounds

### 5. Document Requirements

- Clear description of each permission
- What it enables
- Associated risks

## Permission Assessment Matrix

| Permission  | Required | Scope           | Risk     | Justification                  |
| ----------- | -------- | --------------- | -------- | ------------------------------ |
| read:data   | Yes      | specific folder | Low      | Read-only access needed        |
| write:data  | No       | -               | High     | Not needed for this automation |
| delete:data | No       | -               | Critical | Would be destructive           |

## Principles

1. **Least privilege** - request only what's necessary
2. **Defense in depth** - multiple layers of protection
3. **Assume breach** - limit damage if permissions are compromised
4. **Document everything** - make permissions auditable
