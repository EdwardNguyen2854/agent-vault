# Architecture Deepening Plan

Date: 2025-06-25
Status: Draft — agreed direction, not yet executed

This document records the decisions and execution plan for two architecture deepening
candidates from the [architecture review](../architecture-review.html).

---

## Candidate 1: Delete the ghost tool loop

**Module:** `src/utils/toolLoop.ts` (684 lines)
**Verdict:** Delete outright. `runToolLoop` has zero callers in the codebase.

### Pre-deletion

File a GitHub issue documenting the `isAdvertisableTool` gap:

```text
Title: agentExecution.ts does not filter or pass tool definitions to the model

The deleted toolLoop.ts filtered tools through `isAdvertisableTool()` before
sending them to the model as `tools` parameter in the chat request. This
pre-filtering:

- Excluded disconnected MCP tools
- Excluded inactive/disabled tools
- Checked the agent's tool allowlist
- Checked the permission gate (evaluateToolCall)

agentExecution.ts's `runAgentChat(useTools: true)` path (line 638) calls
modelAdapter.chat() without a `tools` parameter. The model may attempt to
call tools it shouldn't be able to see.

To fix:
1. Import or duplicate the filtering logic from toolLoop.ts
2. Build an OpenAITool[] array from the filtered tools
3. Pass it as the `tools` parameter to modelAdapter.chat()
```

### Deletion

1. Remove `src/utils/toolLoop.ts`
2. Verify `npm run build` passes
3. Verify `grep -r 'toolLoop' src/` returns nothing

---

## Candidate 2: Deepen markdown.ts

**Module:** `src/utils/markdown.ts` (707 lines, 25+ exports, 5 concerns)
**Verdict:** Split into sub-modules + extract task manipulation functions. Keep `src/utils/markdown.ts` as a compatibility shim until every call site is migrated.

### New module layout

```
src/utils/
  markdown/
    parse.ts     — frontmatter, wikilinks, tags, headings, parseNoteContent (orchestrator)
    render.ts    — HTML rendering, DOMPurify sanitization, splitMarkdownBody, MarkdownBlock
    graph.ts     — backlinks, graph data, orphans, broken links, resolveLinkTarget
    entity.ts    — entity type detection (agent/skill/tool from frontmatter/path/tags)
    index.ts     — backward-compatible re-export (export * from each sub-module; temporary task re-export during migration)
  tasks.ts       — updateTaskCompletion, updateTaskLine, updateTaskAssignee
```

### Split boundaries

| Concern | Functions | Moves to |
|---|---|---|
| Frontmatter parsing/update | `splitFrontmatter`, `splitRawFrontmatter`, `updateFrontmatterField`, `getMarkdownBody` | `markdown/parse.ts` |
| Wiki link extraction | `parseWikiLinks` | `markdown/parse.ts` |
| Tag parsing | `parseTags` | `markdown/parse.ts` |
| Heading parsing | `parseHeadings` | `markdown/parse.ts` |
| Full note parsing | `parseNoteContent` | `markdown/parse.ts` (orchestrator) |
| Entity type detection | `getWorkspaceEntityType`, `getAgentNotes`, `getWorkspaceEntityNotes` | `markdown/entity.ts` |
| Graph/backlinks | `buildBacklinks`, `buildUnlinkedMentions`, `buildGraphData`, `getBrokenLinks`, `getOrphanNotes`, `resolveLinkTarget` | `markdown/graph.ts` |
| HTML rendering | `renderMarkdownToHtml`, `renderBlockToHtml`, `renderChatMarkdownToHtml`, `escapeHtmlAttribute`, `splitMarkdownBody`, `MarkdownBlock` | `markdown/render.ts` |
| Task manipulation | `updateTaskCompletion`, `updateTaskLine`, `updateTaskAssignee` | `src/utils/tasks.ts` |

### Migration strategy: 3 phases

**Phase 1 — Create sub-modules**

- Create each sub-module file with the relevant functions
- Keep `markdown.ts` untouched during this phase
- Each sub-module imports from others where dependencies exist:
  - `graph.ts` owns `resolveLinkTarget`, imports `parseWikiLinks` from `parse.ts`, and still uses the shared `text.ts` / `noteKey.ts` helpers
  - `render.ts` imports `wikiLinkRegex` from `parse.ts`
  - `entity.ts` imports no other markdown sub-module
  - `parse.ts` exports the shared `taskRegex` for use by `tasks.ts`

**Phase 2 — Backward-compatible shim**

- Create `markdown/index.ts` that re-exports everything from the markdown sub-modules and temporarily re-exports `../tasks`
- Replace `src/utils/markdown.ts` content with:
  ```typescript
  export * from './markdown/index';
  ```
- Keep the shim in place until Phase 3 is complete and verified

**Phase 3 — Migrate callers**

Update every import site from `./markdown` / `../utils/markdown` to the specific sub-module. Do not consider the split done until this table is empty.

| Target module | Current callers |
|---|---|
| `markdown/parse.ts` | `src/App.tsx` (`parseNoteContent`), `src/utils/vault.ts` (`parseNoteContent`), `src/utils/context.ts` (`getMarkdownBody`), `src/utils/search.ts` (`getMarkdownBody`), `src/utils/internalTools/read.ts` (`getMarkdownBody`) |
| `markdown/graph.ts` | `src/App.tsx` (`buildBacklinks`, `buildGraphData`, `getBrokenLinks`, `getOrphanNotes`, `resolveLinkTarget`), `src/utils/context.ts` (`buildBacklinks`, `resolveLinkTarget`), `src/utils/usageStore.ts` (`buildGraphData`, `getBrokenLinks`, `getOrphanNotes`), `src/utils/tools.ts` (`buildBacklinks`), `src/utils/skills.ts` (`buildBacklinks`), `src/utils/taskConversations.ts` (`buildBacklinks`, `resolveLinkTarget`), `src/components/graph/GraphInspector.tsx` (`buildBacklinks`), `src/components/graph/useGraphStats.ts` (`buildGraphData`, `getOrphanNotes`), `src/components/MemoryView.tsx` (`buildBacklinks`), `src/components/AgentsView.tsx` (`buildBacklinks`), `src/components/Dashboard.tsx` (`getBrokenLinks`, `getOrphanNotes`), `src/components/GraphView.tsx` (`resolveLinkTarget`), `src/components/ContextView.tsx` (`resolveLinkTarget`) |
| `markdown/entity.ts` | `src/App.tsx` (`getWorkspaceEntityNotes`), `src/utils/context.ts` (`getWorkspaceEntityType`), `src/utils/usageStore.ts` (`getWorkspaceEntityNotes`), `src/utils/tools.ts` (`getWorkspaceEntityType`), `src/utils/skills.ts` (`getWorkspaceEntityType`), `src/components/ChatPanel.tsx` (`getWorkspaceEntityType`), `src/components/CommandCenter.tsx` (`getWorkspaceEntityNotes`, `getWorkspaceEntityType`), `src/components/Dashboard.tsx` (`getWorkspaceEntityNotes`), `src/components/AgentsView.tsx` (`getWorkspaceEntityType`), `src/components/ContextView.tsx` (`getWorkspaceEntityType`) |
| `markdown/render.ts` | `src/components/ChatPanel.tsx` (`renderChatMarkdownToHtml`), `src/components/MarkdownPreview.tsx` (`renderMarkdownToHtml`, `splitMarkdownBody`, `renderBlockToHtml`) |
| `src/utils/tasks.ts` | `src/components/TasksView.tsx` (`updateTaskCompletion`, `updateTaskLine`, `updateTaskAssignee`), `src/components/TaskQueue.tsx` (`updateTaskLine`) |

`src/components/TaskDetailModal.tsx` does not call the markdown mutators directly; it should stay untouched unless its props change.

### Dependency graph (no cycles)

```
src/utils/tasks.ts  ←  imports taskRegex from markdown/parse.ts
markdown/parse.ts   ←  no imports from other markdown sub-modules
markdown/graph.ts   ←  imports parseWikiLinks from markdown/parse.ts; defines resolveLinkTarget locally
markdown/entity.ts  ←  no imports from other markdown sub-modules
markdown/render.ts  ←  imports wikiLinkRegex from markdown/parse.ts
markdown/index.ts   ←  re-exports from parse/render/graph/entity and temporarily `../tasks`
```

### Regex sharing

The task regex used by both `parse.ts` (for `parseTasks`) and `tasks.ts`
(for `updateTaskCompletion` etc.) is exported from `parse.ts`:

```typescript
// markdown/parse.ts
export const taskRegex = /^\s*-\s+\[([ xX])\]\s+(.+)$/;

// src/utils/tasks.ts
import { taskRegex } from './markdown/parse';
```

---

## Ordering

| Step | Action | Risk | Est. time |
|---|---|---|---|
| 1 | File issue: `isAdvertisableTool` gap | None | 2 min |
| 2 | Delete `src/utils/toolLoop.ts` | None (dead code) | 1 min |
| 3 | Create `src/utils/tasks.ts` | Low (new file, no deletions) | 15 min |
| 4 | Split `markdown.ts` → sub-modules (Phases 1–2) | Low (backward-compat shim) | 75 min |
| 5 | Migrate import sites (Phase 3) | Low (mechanical, many call sites) | 90 min |

Steps 3–5 can be done incrementally across multiple sessions. Step 2 is
safe to execute immediately once `rg -n 'toolLoop' src` still returns only the definition.

---

## Key decisions recorded

1. **`isAdvertisableTool` logic**: filed as a GitHub issue, not extracted into a
   separate helper. The logic is 12 lines across two pure functions — prose
   documentation is sufficient. The harder design problem (wiring tool definitions
   into `modelAdapter.chat`) is better captured as a discussion issue.

2. **Task manipulation functions**: extracted to `src/utils/tasks.ts`, not into
   `markdown/`. These are content-string mutators triggered by UI events, with
   a different audience and stability profile than the parse/render pipeline.
