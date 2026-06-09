---
name: skill-creator
description: Create new skills, improve existing skills, and measure skill performance. Use when creating a skill from scratch, editing or optimizing an existing skill, running evaluations to test a skill, benchmarking performance, or optimizing skill descriptions for better triggering. Make sure to use this skill whenever the user mentions creating a skill, improving a skill, skill evaluation, or skill benchmarking.
tags: [skill-development, agent, evaluation, iteration]
status: active
author: Anthropic
tools: []
memory: []
---

# Skill Creator

A skill for creating new skills and iteratively improving them.

## Core Loop

1. **Capture intent** - Understand what the skill should do
2. **Write draft** - Create SKILL.md with name, description, instructions
3. **Create test cases** -2-3 realistic prompts to verify the skill works
4. **Run evaluations** - Test with skill vs without skill
5. **Review results** - Human feedback + quantitative benchmarks
6. **Iterate** - Improve based on feedback
7. **Package** - Bundle the final skill

## SKILL.md Format

```markdown
---
name: my-skill
description: What this skill does and when to use it. Be "pushy" - include specific contexts.
---

# My Skill Name

[Instructions for what to do when this skill activates]

## When to Use

[Specific triggers and contexts]

## Workflow

[Step-by-step instructions]
```

## Frontmatter Fields

| Field         | Required | Description                            |
| ------------- | -------- | -------------------------------------- |
| `name`        | Yes      | Unique identifier (lowercase, hyphens) |
| `description` | Yes      | When to trigger + what it does         |
| `status`      | No       | `active`, `inactive`, `error`          |
| `tags`        | No       | Categorization tags                    |
| `tools`       | No       | Pre-approved tools                     |
| `author`      | No       | Who created it                         |

## Writing Good Descriptions

**Be "pushy"** - don't just describe, tell when to use:

❌ "How to build dashboards."
✅ "Build fast dashboards to display internal data. Use when user mentions dashboards, data visualization, metrics, or displaying company data."

## Test Case Format

```json
{
  "skill_name": "example-skill",
  "evals": [
    {
      "id": 1,
      "prompt": "User's realistic task prompt",
      "expected_output": "Description of expected result"
    }
  ]
}
```

## Iteration Principles

1. **Generalize from feedback** - Don't overfit to specific examples
2. **Keep prompts lean** - Remove what isn't pulling its weight
3. **Explain the why** - Help the model understand reasoning
4. **Bundle repeated work** - If all test cases reinvent the same script, add it to `scripts/`

## Evaluation Workflow

1. Spawn subagent **with** skill
2. Spawn subagent **without** skill (baseline)
3. Compare results qualitatively and quantitatively
4. Review with user via eval viewer
5. Improve based on feedback
6. Repeat until satisfied

## Description Optimization

After creating a skill, optimize the description for better triggering:

1. Generate 20 eval queries (8-10 should-trigger, 8-10 should-not-trigger)
2. Review queries with user
3. Run optimization loop
4. Apply best description

## Key Principles

- **Progressive disclosure** - Keep SKILL.md under 500 lines, use references for detail
- **Theory of mind** - Explain why, not just what
- **Avoid rigid MUSTs** - Use explanations over commands
- **Test with real prompts** - Not abstract, but concrete user requests
