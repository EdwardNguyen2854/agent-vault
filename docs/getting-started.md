# Getting Started

## Install and run

```bash
git clone https://github.com/EdwardNguyen2854/agent-vault.git
cd agent-vault
npm install
npm run dev
```

Open the URL printed by Vite (default: `http://localhost:5173`).

## Requirements

- **Node.js** 20 or newer
- **npm** (bundled with Node.js)
- **Chrome** or **Microsoft Edge** for local folder read/write

Firefox and Safari can render the app, but they do not provide the File System Access API write surface used by Agent Vault.

## Open a vault on first launch

On first load, choose one of:

- **Load all starter vaults** — copy every bundled starter into one local folder.
- **A single starter vault** — copy just one of `Personal`, `Agents`, `Project`, `Department`, or `Knowledge`.
- **Open vault** — point at an existing folder of markdown files.

Starter content is bundled from `starter-kit/`:

| Starter      | Role                                        | Writable |
| ------------ | ------------------------------------------- | -------- |
| `Personal`   | Default writable starter                    | ✅       |
| `Agents`     | Reference agent patterns and starter skills | ➖       |
| `Department` | Shared-context department example           | ➖       |
| `Project`    | Shared-context project example              | ➖       |
| `Knowledge`  | Shared-context knowledge base example       | ➖       |

## Vault workflow

1. Run `npm run dev`.
2. Click **Load all starter vaults**, a single starter, or **Open vault**.
3. Select a folder for your notes.
4. Grant read/write permission when prompted.
5. Use the **Vault** menu to quick-switch saved vaults or reopen the default personal vault.
6. Select a note from the sidebar or command center (`Ctrl+K` / `Cmd+K`).
7. Edit and save with `Ctrl+S` / `Cmd+S`.
8. Connect notes with `[[Note Name]]` to populate backlinks and the graph.

The selected folder stays on your machine. Agent Vault does not upload vault content to a server.

## Available scripts

| Command                | Description                                                                |
| ---------------------- | -------------------------------------------------------------------------- |
| `npm install`          | Install dependencies.                                                      |
| `npm run dev`          | Start the Vite dev server on `0.0.0.0` (default: `http://localhost:5173`). |
| `npm run build`        | Type-check and produce a production build in `dist/`.                      |
| `npm run preview`      | Serve the production build from `dist/`.                                   |
| `npm run lint`         | Run `tsc --noEmit` (this project does not use ESLint).                     |
| `npm run format`       | Format all files with Prettier.                                            |
| `npm run bridge:dev`   | Start the MCP bridge in development mode (`tsx watch`).                    |
| `npm run bridge:start` | Start the MCP bridge in production mode (`tsx`).                           |
