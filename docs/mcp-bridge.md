# MCP Bridge

The bridge is a Node.js sidecar (`bridge/`) that spawns stdio MCP servers and exposes a REST API on `localhost:7777` for the browser.

## Running the bridge

```bash
npm run bridge:start       # production
npm run bridge:dev         # development with watch
```

The server listens on `localhost:7777` by default. Use `--port` to change:

```bash
npm start -- --port 9999
```

## API

| Method | Path                    | Description              |
| ------ | ----------------------- | ------------------------ |
| GET    | `/health`               | Bridge health status     |
| GET    | `/servers`              | List all server statuses |
| POST   | `/servers`              | Start an MCP server      |
| POST   | `/servers/:name/remove` | Stop and remove server   |
| GET    | `/servers/:name/tools`  | List available tools     |
| POST   | `/servers/:name/invoke` | Call a tool              |

## Registering a server

From the Tools view in the app, use the **Register** button. Or call the API directly:

```bash
curl -X POST http://localhost:7777/servers \
  -H "Content-Type: application/json" \
  -d '{
    "name": "markitdown",
    "command": "python3",
    "args": ["servers/markitdown-mcp/server.py"]
  }'
```

## MarkItDown server

Bundled at `servers/markitdown-mcp/`. Converts PDF, Word, Excel, PowerPoint, Outlook, HTML, CSV, JSON, XML, EPub, images, audio, ZIP, and YouTube URLs to Markdown.

### Tools

| Name                           | Description                                              | Risk                           |
| ------------------------------ | -------------------------------------------------------- | ------------------------------ |
| `markitdown.convert`           | Convert a local path or approved HTTP(S) URL to Markdown | medium (`ask`)                 |
| `markitdown.list_capabilities` | Report which optional-extras groups are installed        | low (`read-only`)              |
| `markitdown.install_extras`    | `pip install` a MarkItDown extras group                  | high (`ask` + `confirm: true`) |

### Security

- Local file paths use `convert_local` (narrowest API per MarkItDown's own guidance).
- HTTP(S) fetches block loopback, link-local, and private CIDR ranges to avoid SSRF.
- `install_extras` refuses to run without `confirm: true` and is permission-gated in the UI.

## Excel MCP server

Bundled at `servers/excel-mcp/`. Provides Excel workbook operations via Python + openpyxl.

## Architecture

- `bridge/src/index.ts` — Entry point, CLI args, graceful shutdown
- `bridge/src/httpServer.ts` — HTTP API (Node built-in `http.createServer`)
- `bridge/src/mcpClient.ts` — MCP protocol client over stdio JSON-RPC
- `bridge/src/registry.ts` — In-memory server registry + tool cache
- `bridge/src/types.ts` — Shared TypeScript types
