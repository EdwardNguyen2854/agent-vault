---
type: tool
provider: mcp
server: markitdown
tool_id: markitdown.list_capabilities
status: active
permission: read-only
risk: low
description: List the optional-extras groups currently installed for MarkItDown.
install_hint: pip install -r servers/markitdown-mcp/requirements.txt
capabilities_url: https://github.com/microsoft/markitdown
---

# MarkItDown Capabilities

List the optional-extras groups currently installed for MarkItDown.

The bridge spawns `python3 servers/markitdown-mcp/server.py` and proxies the `markitdown.list_capabilities` tool.
