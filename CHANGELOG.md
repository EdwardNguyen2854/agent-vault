# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] — 2026-06-09

### Added

- **Open a local markdown folder** — pick a directory via the browser File System Access API, grant read/write, edit in place.
- **`[[wikilinks]]`** — `[[Note]]`, `[[Note#Heading]]`, `[[Note|Alias]]` with backlinks and broken-link detection.
- **3D knowledge graph** — powered by `react-force-graph-3d` and `three`; filter by missing nodes, agents, orphans.
- **Cross-vault tasks** — collect `- [ ]` items from every note; filter, search, toggle completion back to source.
- **Tags** — extracted from frontmatter (`tags: [a, b]`) and inline (`#tag`, `#folder/tag`); usage summaries and navigation.
- **Agent profiles** — detect `type: agent` notes, show role/status/model/skills, open task counts, backlinks.
- **MCP tool registry** — register tools as markdown notes under `Tools/MCP/` with permission and risk metadata.
- **Memory notes** — save and append personal memory under `Memory/`; shared memory is read-only.
- **Local LM Studio chat** — OpenAI-compatible endpoint with streaming; Vite dev proxy for same-origin requests.
- **Command center** — keyboard-driven search with `>`, `#`, `@`, and `?` prefixes.
- **Local-first guarantee** — the selected folder never leaves the machine; no cloud sync, no server upload.
- **Starter kit** — five bundled vaults: `Personal`, `Agents`, `Department`, `Project`, `Knowledge`.
- **MarkItDown importer** — convert PDF, Word, Excel, PowerPoint, Outlook, HTML, CSV, JSON, XML, EPub, and ZIP to Markdown via a bundled MCP server.
- **Editor modes** — edit, preview, or split-pane; `Ctrl+S` / `Cmd+S` to save directly to disk.
- **Note create/rename/delete** — path validation, conflict detection, cross-platform handling.
- **In-app documentation, roadmap, release notes, and about pages**.

### Known limitations

- Local write support requires Chrome or Microsoft Edge (File System Access API).
- Starter vault content is bundled at build time and copied into a writable folder when selected.
- Frontmatter parsing is intentionally lightweight; complex YAML is not supported.
- No plugin system, Git sync, cloud sync, or embedding index yet.
- Duplicate note names can make short wiki links ambiguous; prefer path-qualified links.
