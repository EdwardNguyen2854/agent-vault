---
type: tool
provider: mcp
server: markitdown
tool_id: markitdown.convert
status: active
permission: ask
risk: medium
description: Convert a file or approved URL to Markdown using Microsoft MarkItDown. Saves a sidecar .md note next to the source.
install_hint: pip install -r servers/markitdown-mcp/requirements.txt
capabilities_url: https://github.com/microsoft/markitdown
---

# MarkItDown Convert

Convert a file or approved URL to Markdown using Microsoft MarkItDown. Saves a sidecar .md note next to the source.

The bridge spawns `python3 servers/markitdown-mcp/server.py` and proxies the `markitdown.convert` tool.
