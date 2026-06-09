# Agent Vault MCP Bridge

Standalone Node.js sidecar that manages MCP server processes and exposes a REST API for the browser.

## Usage

```bash
npm install
npm run dev        # development with watch
npm start          # run with tsx
npm run build      # type-check with tsc
```

The server listens on `localhost:7777` by default. Use `--port` to change:

```bash
npm start -- --port 9999
```

## API

| Method | Path                  | Description              |
| ------ | --------------------- | ------------------------ |
| GET    | /health               | Bridge health status     |
| GET    | /servers              | List all server statuses |
| POST   | /servers              | Start an MCP server      |
| POST   | /servers/:name/remove | Stop and remove server   |
| GET    | /servers/:name/tools  | List available tools     |
| POST   | /servers/:name/invoke | Call a tool              |

## Architecture

- `src/index.ts` — Entry point, CLI args, graceful shutdown
- `src/httpServer.ts` — HTTP API (Node built-in `http.createServer`)
- `src/mcpClient.ts` — MCP protocol client over stdio JSON-RPC
- `src/registry.ts` — In-memory server registry + tool cache
- `src/types.ts` — Shared TypeScript types
