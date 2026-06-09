# Security Model

## Trust boundary

Agent Vault's trust boundary is intentionally narrow. The only parts that run with elevated local access are the browser process and the user-spawned MCP bridge.

| Component                  | Scope                                 | Notes                                                        |
| -------------------------- | ------------------------------------- | ------------------------------------------------------------ |
| Local vault folder         | **Read/write** by the browser only    | No cloud sync, no server upload                              |
| MCP bridge (`bridge/`)     | **Localhost only** (`localhost:7777`) | No authentication — only expose on a trusted machine         |
| MCP servers (`servers/`)   | **User-spawned processes**            | User grants permission per tool; no automated execution      |
| LM Studio chat             | **User-configured endpoint**          | No data leaves the machine unless the user sets a remote URL |
| MarkItDown SSRF protection | **Blocklist enforced**                | Loopback, link-local, and private CIDR ranges are blocked    |

Anything outside these boundaries is out of scope. If in doubt, report it privately via the instructions in `.github/SECURITY.md`.

## Browser requirements

Local folder write access requires the **File System Access API**, available in:

- **Google Chrome 86+**
- **Microsoft Edge 86+**

Firefox and Safari can render the application in read-only mode but cannot write to local folders.

## Permission flow

1. User opens a folder via the browser's File System Access API and grants read/write permission.
2. Agent Vault reads and writes notes directly to that folder — no intermediate server.
3. The MCP bridge runs locally and exposes `localhost:7777` with no authentication. It should only be used on a single-user machine.
4. MCP tool calls require user approval in the UI before execution — no silent tool calls.
5. Folder permission may need to be re-granted after browser restarts or security policy changes.

## Supported versions

| Version | Supported |
| ------- | --------- |
| 1.0.x   | ✅        |
| < 1.0   | ❌        |
