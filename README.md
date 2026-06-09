# Agent Vault

> A local-first markdown workspace for personal knowledge bases and agent-oriented project vaults. Runs in the browser, opens folders of plain `.md` files, and builds connected-note features on top: `[[wikilinks]]`, backlinks, tasks, tags, agent profiles, skills, memory notes, tool metadata, local LM Studio chat, search, and an interactive 3D graph.

<!-- Screenshots — place PNG files in docs/screenshots/ and uncomment the img tags below -->
<!--
<img src="docs/screenshots/dashboard.png" width="49%" alt="Dashboard" />
<img src="docs/screenshots/graph-3d.png" width="49%" alt="3D Knowledge Graph" />
<img src="docs/screenshots/editor-split.png" width="49%" alt="Split-pane Editor" />
<img src="docs/screenshots/command-center.png" width="49%" alt="Command Center" />
<img src="docs/screenshots/chat.png" width="49%" alt="LM Studio Chat" />
-->

[![CI](https://github.com/EdwardNguyen2854/agent-vault/actions/workflows/ci.yml/badge.svg)](https://github.com/EdwardNguyen2854/agent-vault/actions/workflows/ci.yml)
[![Deploy](https://github.com/EdwardNguyen2854/agent-vault/actions/workflows/pages.yml/badge.svg)](https://EdwardNguyen2854.github.io/agent-vault/)
[![License](https://img.shields.io/github/license/EdwardNguyen2854/agent-vault?style=flat-square)](LICENSE)
[![Stars](https://img.shields.io/github/stars/EdwardNguyen2854/agent-vault?style=social)](https://github.com/EdwardNguyen2854/agent-vault/stargazers)
[![Version](https://img.shields.io/github/v/release/EdwardNguyen2854/agent-vault?include_prereleases&style=flat-square)](https://github.com/EdwardNguyen2854/agent-vault/releases)
![Platform](https://img.shields.io/badge/platform-Chrome%20%7C%20Edge-f59e0b?style=flat-square)
![Stack](https://img.shields.io/badge/stack-React%20%7C%20Vite%20%7C%20TypeScript-8b5cf6?style=flat-square)
![Local](https://img.shields.io/badge/local--first-yes-10b981?style=flat-square)

---

## Table of Contents

- [Overview](#overview)
- [Highlights](#highlights)
- [Quick Start](#quick-start)
- [Requirements](#requirements)
- [Features](#features)
  - [Notes & Editor](#notes--editor)
  - [Connections & Graph](#connections--graph)
  - [Tasks, Tags & Search](#tasks-tags--search)
  - [Agents, Tools & Memory](#agents-tools--memory)
  - [Local LM Studio Chat](#local-lm-studio-chat)
- [Scripts](#scripts)
- [Vault Workflow](#vault-workflow)
- [Supported Markdown Conventions](#supported-markdown-conventions)
- [Suggested Vault Structure](#suggested-vault-structure)
- [Local-First Behavior](#local-first-behavior)
- [Architecture](#architecture)
- [Development](#development)
- [Troubleshooting](#troubleshooting)
- [Limitations](#limitations)
- [Roadmap](#roadmap)
- [License](#license)

---

## Overview

**Agent Vault** is a single-page React + Vite + TypeScript app inspired by Obsidian. It opens a folder of plain markdown files directly in your browser through the File System Access API, lets you edit your personal vault on disk, and layers agent-aware features on top of ordinary `.md` notes.

It is designed for two kinds of users:

- **Personal knowledge workers** who want wiki links, backlinks, tasks, tags, and a 3D graph over a folder they fully own.
- **Agent builders** who keep agent profiles, skills, memory, tool metadata, and Agent Run records as portable markdown that can travel between editors and tools.

| Field                | Value                                            |
| -------------------- | ------------------------------------------------ |
| Version              | `0.1.0`                                          |
| License              | MIT                                              |
| Stack                | React, Vite, TypeScript, ESM                     |
| Storage              | Browser File System Access API (local folder)    |
| Networking           | Local-only; optional LM Studio proxy at `/lms/*` |
| Supported Browsers   | Chrome, Microsoft Edge                           |
| Unsupported Browsers | Firefox, Safari (read-only, no folder write)     |

---

## Highlights

- 📁 **Open a local markdown folder** — pick a directory, grant read/write, edit in place.
- 🔗 **Obsidian-style wiki links** — `[[Note]]`, `[[Note#Heading]]`, `[[Note|Alias]]`, with backlinks and broken-link detection.
- 🧭 **3D knowledge graph** — notes, links, missing targets, agents, orphans, and local neighborhoods.
- ✅ **Cross-vault tasks** — collect `- [ ]` items, filter, search, and toggle completion back to disk.
- 🏷️ **Tags from frontmatter and inline** — usage summaries and tag-driven navigation.
- 🧑‍🚀 **Agent notes** — detect `type: agent` notes, show role/status/model/skills, task counts, and connections.
- 🛠️ **MCP tool registry** — register tools as markdown notes with permission and risk metadata.
- 🧠 **Memory notes** — save and append personal memory under `Memory/`, with shared memory in read-only mode.
- 💬 **Local LM Studio chat** — OpenAI-compatible local model endpoint with streaming.
- ⌨️ **Command center** — keyboard-driven search with `>`, `#`, `@`, and `?` prefixes.
- 💾 **Local-first** — your folder never leaves your machine.

> **For agent builders** — see [`starter-kit/Agents/`](starter-kit/Agents/) for agent profiles, skills, memory notes, tool metadata, and Agent Run records as portable markdown. Run `npm run bridge:start` to launch the MCP bridge on `localhost:7777`.

---

## Quick Start

```bash
git clone https://github.com/EdwardNguyen2854/agent-vault.git
cd agent-vault
npm install
npm run dev
```

Open the URL printed by Vite (default: `http://localhost:5173`).

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

---

## Requirements

- **Node.js** 20 or newer
- **npm** (bundled with Node.js)
- **Chrome** or **Microsoft Edge** for local folder read/write

Firefox and Safari can render the app, but they do not provide the File System Access API write surface used by Agent Vault.

---

## Features

### Notes & Editor

- Recursive read of `.md` and `.markdown` files from the selected folder.
- Ignores generated and hidden folders: `.git`, `node_modules`, `dist`, `.obsidian`, and any dot-prefixed directory.
- Edit in **edit**, **preview**, or **split** mode.
- Save directly back to the local file with `Ctrl+S` / `Cmd+S`.
- Create, rename, and delete notes with path validation and conflict detection.
- Bundled starter kit copy-to-folder flow for first-run setup.
- Persists UI preferences: theme, view, editor mode, last vault name.

### Connections & Graph

- Resolves `[[wikilinks]]`, `[[wikilinks#heading]]`, `[[wikilinks|aliases]]` against title, file name, path, and full path.
- Shows **backlinks**, **outgoing links**, **unlinked mentions**, **broken links**, **headings**, and **note metadata**.
- Visualizes the vault in a 3D graph (powered by `react-force-graph-3d` and `three`).
- Filters: missing nodes, agents, orphans, and local neighborhoods.

### Tasks, Tags & Search

- Collects GitHub-flavored markdown tasks from every note.
- Task filters: active / completed, search, and toggle completion back to source.
- Recognized task metadata: `due:YYYY-MM-DD`, `@assignee`, `#tag`.
- Extracts inline tags (`#tag`, `#folder/tag`, `#tag-name`) and frontmatter tags.
- Ranked search across title, path, tags, and content snippets.

### Agents, Tools & Memory

- **Agent detection** via `type: agent` frontmatter, an `Agents/` folder, or the `#agent` tag.
- Agent profile cards with role, status, model, skills, readiness, backlinks, and open task counts.
- **MCP tool registry** — register tools as markdown notes under `Tools/MCP/` with `permission` and `risk` metadata.
- Supervised internal browser tools for reading notes and approval-gated personal-vault writes.
- **Agent Run** records with steps, approvals, tool transcript metadata, reasoning summaries, and final output.
- **Memory notes** grouped by memory type; personal memory writes allowed, shared memory read-only.
- **MarkItDown importer** — convert PDF, Word, Excel, PowerPoint, Outlook, HTML, CSV, JSON, XML, EPub, and ZIP files to Markdown and save them as sidecar notes through the MarkItDown MCP server (`servers/markitdown-mcp/`).

### Local LM Studio Chat

- Default `baseUrl` is `/lms/v1`, proxied by the Vite dev server to `http://localhost:1234/*` (LM Studio's default local server).
- OpenAI-compatible: chat, models, and streaming endpoints.
- In production builds, set the **Base URL** in Settings to your LM Studio URL and enable **CORS** for your app's origin.

---

## Scripts

| Command           | Description                                                                |
| ----------------- | -------------------------------------------------------------------------- |
| `npm install`     | Install dependencies.                                                      |
| `npm run dev`     | Start the Vite dev server on `0.0.0.0` (default: `http://localhost:5173`). |
| `npm run build`   | Type-check and produce a production build in `dist/`.                      |
| `npm run preview` | Serve the production build from `dist/`.                                   |
| `npm run lint`    | Run `tsc --noEmit` (this project does not use ESLint).                     |

---

## Vault Workflow

1. Run `npm run dev`.
2. Click **Load all starter vaults**, a single starter, or **Open vault**.
3. Select a folder for your notes.
4. Grant read/write permission when prompted.
5. Use the **Vault** menu to quick-switch saved vaults or reopen the default personal vault.
6. Select a note from the sidebar or command center (`Ctrl+K` / `Cmd+K`).
7. Edit and save with `Ctrl+S` / `Cmd+S`.
8. Connect notes with `[[Note Name]]` to populate backlinks and the graph.

The selected folder stays on your machine. Agent Vault does not upload vault content to a server.

---

## Supported Markdown Conventions

### Wiki Links

```markdown
See [[Launch Plan]] for the project schedule.
See [[Launch Plan|the launch plan]] for a readable alias.
See [[Launch Plan#Milestones]] for a heading-specific reference.
```

Links resolve against note title, file name, path without extension, or full path. Unresolved targets are surfaced as missing nodes in the graph and counted as broken links on the dashboard.

### Tags

```markdown
---
tags: [project, research]
---

# Launch Plan

This note is part of #agent-vault and #release.
```

Tags support letters, numbers, underscores, slashes, and hyphens.

### Tasks

```markdown
- [ ] Draft release notes due:2026-06-14 @nora #release
- [x] Review [[Agent Vault MVP]]
```

The Tasks view aggregates tasks from every note, filters active or completed work, supports search, and toggles completion back to the source markdown when the vault is writable.

### Frontmatter

```markdown
---
title: Launch Plan
tags: [project, launch]
status: active
type: agent
role: researcher
model: DeepSeek V4
---
```

The parser is intentionally lightweight. Complex YAML features such as nested objects, multiline strings, and advanced quoting are not supported yet. Legacy agent `skills` and `tools` arrays may be displayed as descriptive metadata, but they do not restrict access to shared skills or tools.

### Executable Agent Skills

Executable skills use the Agent Skills package layout:

```text
Agents/
  Skills/
    literature-review/
      SKILL.md
      references/
      scripts/
      assets/
```

`SKILL.md` must include `name` and `description` frontmatter. The `name` must be lowercase, hyphenated, 64 characters or fewer, and match the parent folder name.

```markdown
---
name: literature-review
description: Use when researching, comparing sources, or drafting a literature review.
---

# Literature Review

Read the selected sources, compare claims, track citations, and produce a concise synthesis.
```

Agent Vault treats `SKILLS.md` files as index notes only. Legacy root-level `Skills/<skill-name>/SKILL.md` packages are still supported. Flat notes marked `type: skill` remain browseable vault knowledge, but they are not executable skills and are not auto-routed in chat until packaged as `<skill-name>/SKILL.md`.

---

## Suggested Vault Structure

```text
My Vault/
  Home.md
  Profile/
    PROFILE.md
  Shared/
    SHARED.md
    Runs/
      README.md
      2026-06-09 - Obra - Example.md
  Projects/
    Launch Plan.md
    Agent Vault MVP.md
    Agents/
      Agents.md
      Shared/
        USER.md
        MEMORY.md
        RULES.md
      Profiles/
        Obra/
          SOUL.md
          MEMORY.md
        Nora/
          SOUL.md
          MEMORY.md
      Skills/
        SKILLS.md
        note-taxonomy-design/
          SKILL.md
        workflow-analysis/
          SKILL.md
      Tools/
        TOOLS.md
        excel-mcp/
          TOOL.md
  Knowledge/
    Vault Map.md
    MCP Notes.md
```

This is a convention, not a requirement. Agent Vault scans any nested folder of markdown files the browser is allowed to read. `Agent Runs/` markdown logs are the durable source for skill and tool usage history.

---

## Local-First Behavior

- The bundled starter kit is read-only.
- Exactly one personal vault is writable at a time.
- Shared vaults are read-only; duplicate mounts are blocked when the browser can identify the same folder.
- Create, rename, delete, save, task toggles, memory writes, generated notes, and tool permission changes are limited to personal vault notes.
- Writable mode uses browser-granted access to the selected personal folder.
- Notes are saved as plain markdown files in the same folder you opened.
- Folder access may need to be re-granted after refreshes or browser restarts.
- Renames copy content to the new path first, then delete the old file, to avoid losing note content if the copy fails.

### Path Rules

When creating or renaming notes, Agent Vault normalizes and validates paths:

- Backslashes are converted to `/`.
- Leading and trailing slashes are stripped.
- Repeated whitespace is normalized.
- `.md` is added if no markdown extension is provided.
- Empty paths are rejected.
- Path traversal with `..` is rejected.
- Cross-platform invalid filename characters are rejected.
- Paths longer than 240 characters and file names longer than 100 characters are rejected.
- Existing note paths are checked case-insensitively before create or rename.

---

## Architecture

Agent Vault is a single-page React app. See [`docs/architecture.md`](docs/architecture.md) for the full module map and responsibility table.

---

## Development

- React + Vite + TypeScript, ESM.
- TypeScript uses Vite/Bundler-style module resolution.
- `react-force-graph-3d` and `three` power the 3D graph.
- `marked` renders markdown; `DOMPurify` sanitizes rendered HTML.
- No unit test framework is configured — use `npm run build` (which runs `tsc --noEmit`) as the primary validation step.
- `npm run lint` is a typecheck command, not an ESLint run.
- Build output goes to `dist/` and should not be edited by hand.

---

## Troubleshooting

### The app cannot save files

Use Chrome or Microsoft Edge and open a local folder with **Open vault** or a starter vault. Unsupported browsers may not expose local file write permissions.

### The browser asks for permission again

This is normal. Browser-granted folder handles can expire or require renewed permission after refreshes, restarts, or security changes.

### AI chat cannot reach LM Studio

In development, the Vite dev server proxies `/lms/*` to `http://localhost:1234/*` (LM Studio's default local server), so the app's default `baseUrl` is `/lms/v1` and the browser sees same-origin requests. Make sure LM Studio is running with **Start Server** enabled in the Developer tab and at least one model loaded.

In a production build served from a static host, `/lms/*` is meaningless. Set the AI **Base URL** in Settings to `http://localhost:1234/v1` (or your remote LM Studio URL) and enable **CORS** for your app's origin in LM Studio's Developer → Local Server settings. CORS is the only required change; chat, models, and streaming endpoints are OpenAI-compatible.

### My link shows as missing

Match the link target to a note title, file name without `.md`, full path without `.md`, or full path. For duplicates, prefer path-qualified links such as `[[Projects/Launch Plan]]`.

### A tag does not appear

Inline tags must look like `#tag`, `#folder/tag`, or `#tag-name`. Frontmatter tags should be a comma-separated string or array-like value such as `tags: [research, agent]`.

### A task does not appear

Tasks must use `- [ ]` or `- [x]` at the start of a markdown list line. Other checkbox formats are not parsed yet.

### A note is not detected as an agent

Add `type: agent` to frontmatter, move the note under an `Agents/` folder, or add the `#agent` tag.

---

## Limitations

- Local write support depends on browser File System Access API support.
- Starter vault content is bundled at build time and copied into a writable folder when selected.
- Frontmatter parsing supports simple keys and arrays only.
- No plugin system yet.
- No Git sync, cloud sync, embedding index, or built-in AI chat beyond LM Studio.
- Duplicate note names can make short wiki links ambiguous; prefer path-qualified links in large vaults.

---

## Roadmap

- **Knowledge Model** — better linking, metadata, and discovery across notes, memory, tools, skills, and agents.
- **Agent Workflow** — improved context, queues, permissions, and run record automation.
- **Interoperability** — deeper MCP server support, external runtime integration, and markdown convention compatibility.
- **Extensibility** — custom views, metadata panels, plugin hooks, and vault automation workflows.

---

## License

Released under the [MIT License](LICENSE).
