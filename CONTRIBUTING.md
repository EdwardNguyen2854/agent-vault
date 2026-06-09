# Contributing to Agent Vault

Thank you for your interest in contributing. This guide covers setup, code style, commit conventions, and the PR process.

## Development setup

```bash
git clone https://github.com/EdwardNguyen2854/agent-vault.git
cd agent-vault
npm install
npm run dev
```

Open `http://localhost:5173`. The app runs entirely in the browser; no backend is needed for local development.

To run the MCP bridge (required for tool registry features):

```bash
npm run bridge:start
```

To run the bridge in watch mode during development:

```bash
npm run bridge:dev
```

## Code style

- **TypeScript**: strict mode, ESM imports, functional components.
- **Naming**: PascalCase for components and files (e.g. `GraphView.tsx`), camelCase for functions and variables.
- **Formatting**: Prettier is configured. Run `npm run format` before committing. CI runs `npm run format:check` which fails on unformatted files.
- **No formatter configured in-repo?** Match surrounding style and keep diffs minimal. Prettier will enforce consistency going forward.

## Testing

There is no unit test framework. The primary validation step is:

```bash
npm run build   # runs tsc --noEmit then vite build
```

When changing markdown parsing, vault access, graph, or task logic, verify behavior manually in the browser with a local vault and the bundled starter kit.

## Commit convention

Use short, imperative commit messages:

```
feat: add agent profile cards with role and skills
fix: task toggle not writing back to disk
docs: add MCP bridge API reference
chore: pin dependencies to resolved versions
```

Avoid vague messages like "update" or "fix stuff".

## Pull request process

1. **Fork and branch** from `main`. Use a descriptive branch name (e.g. `feat/agent-run-records`).
2. **Make your changes.** Run `npm run build` locally before opening a PR.
3. **Fill in the PR template.** The template asks for: summary, type of change, testing done, and vault context.
4. **Screenshots or recordings are required for any UI change.** Drag-and-drop them into the PR body.
5. **Link the issue** if one exists (e.g. `Fixes #12`).
6. CI must pass before merging: `tsc --noEmit`, `npm run format:check`, `npm run build`, and bridge type-check.

## How to run the app with LM Studio chat

1. Start LM Studio with **Start Server** enabled in the Developer tab.
2. Load at least one model.
3. Run `npm run dev` and open `http://localhost:5173`.
4. The chat panel uses `/lms/v1` by default (Vite proxies to `localhost:1234`).

## How to test MCP tool registration

1. Start the bridge: `npm run bridge:start`.
2. Open the app and navigate to the **Tools** view.
3. Click **Register** and enter the server name and command.
4. Approve the tool call when prompted.

## Getting help

Open a [GitHub Discussion](https://github.com/EdwardNguyen2854/agent-vault/discussions) for questions about the codebase or architecture. For bugs, use the Bug Report issue template. For vault convention questions, use the Vault Help template.
