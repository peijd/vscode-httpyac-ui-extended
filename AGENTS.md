# Repository Guidelines

## Project Structure & Module Organization
- Extension runtime lives in `src/`. Key folders: `provider/` (VS Code integrations), `webview-bridge/` (messaging layer), `webview/` (React UI), and `plugin/` (httpyac adapters). Response history lives under `.httpyac` via the `StorageProvider`.
- Compiled output is emitted to `dist/` via esbuild. Test fixtures and examples sit in `examples/` and `http/`. Schemas, snippets, and grammars are in their respective top-level directories.

## Build, Test, and Development Commands
- `npm run watch` — esbuild incremental watch for the extension runtime.
- `npm run compile` — builds the webview (`npm run build:webview`) and bundles the extension with minification.
- `npm run tsc -- --noEmit` — type-checks both the extension and webview TypeScript projects.
- `npm run lint` — formats with Prettier, runs ESLint, `lockfile-lint`, and a TypeScript build for sanity.
- `npm run watch:webview` — runs Vite dev server for the React UI under `src/webview`.

## Coding Style & Naming Conventions
- TypeScript across both extension/runtime and React UI. Keep modules small and prefer descriptive filenames (`requestCommandsController.ts`).
- Use Prettier (default config) and ESLint with `@typescript-eslint`. Run `npm run lint` before committing.
- Stick to camelCase for variables/functions, PascalCase for classes/components, and prefix VS Code commands with `httpyac.` (see `src/config.ts`).

## Testing Guidelines
- No automated test suite yet; rely on `npm run tsc -- --noEmit` and `npm run lint` as the fast regression checks.
- When adding scripted validation, name files `*.spec.ts` under the relevant folder to match existing conventions if a test harness is introduced later.

## Commit & Pull Request Guidelines
- Follow conventional, imperative commit messages (e.g., `Add webview message bridge`). Keep one logical change per commit when possible.
- PRs should describe the motivation, summarize key changes, list any new commands/config, and link issues when applicable. Include screenshots/GIFs for UI updates (webview/editor) and mention how the change was validated (`npm run lint`, manual scenario, etc.).

## Security & Configuration Tips
- Respect VS Code workspace trust: IO helpers guard against reading outside trusted folders; do not remove those checks.
- Response files are persisted under `.httpyac`; ensure new features clean up via the `StorageProvider` to avoid leaking sensitive payloads.
