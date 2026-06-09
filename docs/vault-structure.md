# Vault Structure

## Suggested vault structure

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

## Local-first behavior

- The bundled starter kit is read-only.
- Exactly one personal vault is writable at a time.
- Shared vaults are read-only; duplicate mounts are blocked when the browser can identify the same folder.
- Create, rename, delete, save, task toggles, memory writes, generated notes, and tool permission changes are limited to personal vault notes.
- Writable mode uses browser-granted access to the selected personal folder.
- Notes are saved as plain markdown files in the same folder you opened.
- Folder access may need to be re-granted after refreshes or browser restarts.
- Renames copy content to the new path first, then delete the old file, to avoid losing note content if the copy fails.

## Path rules

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
