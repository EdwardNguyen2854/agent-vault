---
type: tool
provider: mcp
server: markitdown
tool_id: markitdown.install_extras
status: active
permission: ask
risk: high
description: pip-install a MarkItDown extras group to enable additional file types. Requires explicit confirmation.
install_hint: pip install -r servers/markitdown-mcp/requirements.txt
capabilities_url: https://github.com/microsoft/markitdown
---

# MarkItDown Install Extras

pip-install a MarkItDown extras group to enable additional file types. Requires explicit confirmation.

The bridge spawns `python3 servers/markitdown-mcp/server.py` and proxies the `markitdown.install_extras` tool.
