# Repository Guidelines

## Project Structure & Module Organization

This is a single-page React + Vite app written in TypeScript. Core application state lives in `src/App.tsx`, with feature UI split across `src/components/` and shared logic in `src/utils/`. Key files include `src/utils/vault.ts` for File System Access API helpers, `src/utils/markdown.ts` for wiki links, backlinks, tasks, and rendering, and `src/types.ts` for shared interfaces. Static assets belong in `public/`, and sample vaults live in `starter-kit/`. Build output is written to `dist/` and should not be committed.

## Build, Test, and Development Commands

Use npm for all project commands:

- `npm install` - install dependencies.
- `npm run dev` - start the Vite dev server on `0.0.0.0`.
- `npm run build` - run TypeScript type-checking and create a production build in `dist/`.
- `npm run preview` - serve the built app locally.
- `npm run lint` - run `tsc --noEmit`; this repo does not currently use ESLint.

## Coding Style & Naming Conventions

Follow the existing TypeScript and React patterns: strict typing, ESM imports, functional components, and PascalCase for components and files such as `GraphView.tsx`. Use camelCase for functions, variables, and utility exports. Keep edits localized and prefer the existing utility modules over adding new abstractions. No formatter is configured in-repo, so match surrounding style and keep diffs minimal.

## Testing Guidelines

There is no test framework configured. Use `npm run build` as the primary validation step because it catches both type errors and bundling issues. When changing markdown parsing, vault access, or graph/task logic, verify behavior manually in the browser with a local vault and the sample vault.

## Commit & Pull Request Guidelines

Git history is minimal and does not show a formal commit convention yet; keep commit messages short and imperative, such as `fix task toggle rendering`. Pull requests should summarize the user-facing change, note any vault or browser permission impact, and include screenshots or short recordings for UI changes.

## Security & Configuration Tips

The app reads and writes local folders through the browser File System Access API, so Chrome or Edge is required for writable vaults. Do not commit `.env`, `dist/`, or local vault data. Hidden directories such as `.git`, `node_modules`, `.obsidian`, and dot-prefixed folders are intentionally ignored during scans.
