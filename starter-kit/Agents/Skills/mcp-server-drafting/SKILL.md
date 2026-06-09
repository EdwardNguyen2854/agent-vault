---
name: mcp-server-drafting
description: Design and draft MCP (Model Context Protocol) servers. Use when building MCP servers, designing tool interfaces, creating API specifications, or implementing tool integrations. Make sure to use this skill whenever the user mentions MCP servers, tool integration, API design, or MCP implementation.
tags: [automation, mcp, integration, api, tools]
status: active
author: Nora
tools: []
memory: []
---

# MCP Server Drafting

Design and draft MCP servers for tool integration.

## When to Use

This skill activates when:

- User asks to build an MCP server
- Designing tool interfaces
- Creating API specifications
- Implementing custom tools

## Workflow

### 1. Define Interface

- What tools does the server expose?
- Input/output schemas
- Error handling requirements

### 2. Choose Protocol

- MCP vs custom API
- Authentication method
- Transport layer

### 3. Design Schema

- Tool definitions
- Parameter validation
- Response formats

### 4. Implement Server

- Request handling
- State management
- Error responses

### 5. Document API

- Usage examples
- Error codes
- Setup instructions

## Tool Definition Example

```json
{
  "name": "excel_analyze",
  "description": "Analyze Excel file structure",
  "inputSchema": {
    "type": "object",
    "properties": {
      "file_path": {
        "type": "string",
        "description": "Path to Excel file"
      },
      "analysis_type": {
        "type": "string",
        "enum": ["structure", "formulas", "pivots"]
      }
    }
  }
}
```

## Principles

1. **Validate inputs** - always check types, ranges, required fields
2. **Log everything** - input params, output results, timing
3. **Handle timeouts** - set reasonable limits
4. **Be idempotent** - same input should produce same output
