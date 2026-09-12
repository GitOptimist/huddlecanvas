# Hosted Alpha development guide

## Current checkpoint

Branch `m3/hosted-alpha` starts the production-shaped application while tag `prototype-v8` preserves the portable research build. The repository root `index.html` is intentionally unchanged.

The current M3.5 slice provides:

- a pnpm/Turborepo workspace;
- a React/TypeScript hosted canvas;
- one versioned canonical board schema with validation and deterministic serialization;
- a read-only v8 importer with an explicit loss report;
- pure board commands for add, remove, move, resize, lock, reparent, reorder, and rename;
- spatial lasso hit-testing that is separate from persistent frame objects;
- a capability-based authorization matrix;
- API and realtime service contracts with honest implementation boundaries;
- local and external OIDC session flows;
- file or PostgreSQL board persistence, autosave, version history, and recovery;
- select, pan, pen, highlighter, stroke eraser, sticky note, text, shape, zoom, and fit interactions;
- foundation, API, build, typecheck, and browser test coverage.

Realtime transport, guest links, asset storage, and full v8 workflow parity are **not implemented** at this checkpoint.

## Repository map

```text
apps/web/                 React hosted canvas and authenticated workspace shell
apps/api/                 Fastify auth, board, persistence, and web-serving boundary
apps/realtime/            Presence/command protocol contract (no transport yet)
packages/board-schema/    Canonical document, validation, migrations, v8 importer
packages/canvas-core/     Pure commands and geometry
packages/authz/           Roles and capabilities
tests/e2e/                Hosted shell smoke test
index.html                Preserved v8 portable prototype
```

## Run the foundation tests

Node 22.14 or newer is required. These tests intentionally run before third-party packages are installed:

```bash
pnpm test:foundation
```

## Run the hosted shell

```bash
corepack enable
pnpm install
pnpm --filter @huddlecanvas/web dev
```

Open `http://localhost:5173`. In development, configure dev auth as documented in `.env.example`; staging uses external OIDC. Canvas changes autosave through the API and appear in version history.

## Build and check

```bash
pnpm typecheck
pnpm build
pnpm test:e2e
```

## v8 import policy

Call `importLegacyV8(payload)` at an explicit import boundary. Never overwrite the source payload. Review every reported warning, upload embedded media through the future asset service, resolve legacy assignees against real user identities, and save only after the resulting canonical document passes validation.

Representative fixtures live in `packages/board-schema/fixtures`.

## Next vertical slice

Continue M3.5 with deeper selection and editing parity: lasso/multi-select, resize and rotate handles, contextual object actions, undo/redo, deletion, duplicate, lock, grouping, and keyboard workflows. Keep server capabilities authoritative and persist every canonical document mutation through the existing autosave/version boundary.
