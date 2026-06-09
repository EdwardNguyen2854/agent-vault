---
name: workflow-analysis
description: Analyze workflows for automation potential. Use when analyzing workflows, identifying pain points, assessing automation candidates, or mapping process steps. Make sure to use this skill whenever the user mentions workflows, process analysis, automation assessment, or workflow mapping.
tags: [automation, workflow, analysis, process]
status: active
author: Nora
tools: []
memory: []
---

# Workflow Analysis

Analyze workflows to identify automation opportunities.

## When to Use

This skill activates when:

- User asks to analyze a workflow
- Discussing process improvement
- Identifying repetitive tasks
- Assessing automation potential

## Workflow

### 1. Map Current Flow

- Document each step with inputs/outputs
- Identify decision points
- Note manual vs automated steps

### 2. Identify Pain Points

- Repetition: steps repeated daily
- Manual error: steps prone to typos
- Delay: waiting for manual action

### 3. Assess Automation Candidates

- Rule-based vs judgment-based
- Frequency of execution
- Complexity of decision logic

### 4. Propose Scope

- What to automate vs keep manual
- Expected time savings
- Risk assessment

## Analysis Template

```markdown
## Current Workflow: [Name]

### Steps

1. [Step description] → input: X, output: Y
2. [Step description] → input: Y, output: Z

### Pain Points

### Automation Candidates

| Step | Automatable? | Rule-based? | Effort |
| ---- | ------------ | ----------- | ------ |
| A    | Yes          | Yes         | Low    |
| B    | Partial      | Yes         | Medium |
```

## Principles

1. **Automate only after understanding** - never automate a process you don't fully understand
2. **Focus on pain points** - prioritize high-repetition, high-error tasks
3. **Keep human in the loop** - for judgment-based decisions
