# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Supported Browsers

Local folder write access requires the **File System Access API**, which is
available in:

- **Google Chrome 86+**
- **Microsoft Edge 86+**

Firefox and Safari can render the application in read-only mode but cannot
write to local folders.

## Reporting a Vulnerability

For security-sensitive issues — particularly anything involving local file
access, the MCP bridge, or LM Studio integration — please **do not open a
public GitHub Issue**.

Instead, contact the maintainer directly:

> Email: (replace with maintainer email — e.g. `security@example.com`)

Please include:

- A description of the issue and its potential impact
- Steps to reproduce (if applicable)
- Any suggested mitigations (optional)

The maintainer aims to acknowledge reports within **48 hours** and to provide
a resolution or mitigation plan within **14 days**. If the issue is severe
enough to warrant immediate public attention (e.g., remote code execution),
please use private disclosure first.

## Scope

Agent Vault's trust boundary is intentionally narrow:

| Component                  | Scope                                 | Notes                                                        |
| -------------------------- | ------------------------------------- | ------------------------------------------------------------ |
| Local vault folder         | **Read/write** by the browser only    | No cloud sync, no server upload                              |
| MCP bridge (`bridge/`)     | **Localhost only** (`localhost:7777`) | No authentication — only expose on a trusted machine         |
| MCP servers (`servers/`)   | **User-spawned processes**            | User grants permission per tool; no automated execution      |
| LM Studio chat             | **User-configured endpoint**          | No data leaves the machine unless the user sets a remote URL |
| MarkItDown SSRF protection | **Blocklist enforced**                | Loopback, link-local, and private CIDR ranges are blocked    |

Anything outside these boundaries is out of scope. If in doubt, report it
privately and let the maintainer make the call.
