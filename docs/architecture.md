# Architecture

Agent Vault is a single-page React app. Most application state lives in `src/App.tsx`, with focused utilities and components for parsing, filesystem access, graph logic, search, and views.

| Path                               | Responsibility                                                                                                                             |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/App.tsx`                      | App-level state, vault loading, note selection, save/create/rename/delete, global shortcuts, view routing.                                 |
| `src/utils/vault.ts`               | File System Access API helpers, directory scanning, note loading, writing, creation, rename, delete, starter copy.                         |
| `src/utils/vaultRegistry.ts`       | IndexedDB persistence for saved vault handles, quick switching, default personal vault.                                                    |
| `src/utils/markdown.ts`            | Frontmatter, wiki links, tags, tasks, headings, backlinks, graph data, broken links, orphans, agent detection, rendering, task toggling.   |
| `src/utils/graph.ts`               | Graph filtering and node-connection highlighting.                                                                                          |
| `src/utils/search.ts`              | Ranked note search by title, path, tags, and content snippets.                                                                             |
| `src/utils/paths.ts`               | Vault path normalization, validation, default path generation, conflict checks.                                                            |
| `src/utils/preferences.ts`         | Local preference persistence for theme, view, editor mode, last vault name.                                                                |
| `src/components/GraphView.tsx`     | 3D graph rendering and filtering UI.                                                                                                       |
| `src/components/TasksView.tsx`     | Cross-vault task list, filters, search, completion toggles.                                                                                |
| `src/components/TagsView.tsx`      | Tag usage summaries and tag-driven note navigation.                                                                                        |
| `src/components/AgentsView.tsx`    | Agent profile cards, filters, readiness, task counts, backlinks, detail drawer.                                                            |
| `src/components/CommandCenter.tsx` | Keyboard-driven command, note, tag, agent, task, and health search.                                                                        |
| `src/components/ProductPages.tsx`  | In-app documentation, roadmap, release notes, and about pages.                                                                             |
| `bridge/`                          | Node + `tsx` sidecar that spawns stdio MCP servers (`bridge/src/mcpClient.ts`) and exposes a REST API on `localhost:7777` for the browser. |
| `servers/excel-mcp/`               | Reference Python MCP server for Excel workbooks.                                                                                           |
| `servers/markitdown-mcp/`          | Python MCP server wrapping [`microsoft/markitdown`](https://github.com/microsoft/markitdown) for converting documents to Markdown.         |
