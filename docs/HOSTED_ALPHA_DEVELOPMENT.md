# Hosted Alpha development guide

## Current checkpoint

Branch `m3/hosted-alpha` starts the production-shaped application while tag `prototype-v8` preserves the portable research build. The repository root `index.html` is intentionally unchanged.

M3.1 currently provides:

- a pnpm/Turborepo workspace;
- a React/TypeScript read-only model proof;
- one versioned canonical board schema with validation and deterministic serialization;
- a read-only v8 importer with an explicit loss report;
- pure board commands for add, remove, move, resize, lock, reparent, reorder, and rename;
- spatial lasso hit-testing that is separate from persistent frame objects;
- a capability-based authorization matrix;
- API and realtime service contracts with honest implementation boundaries;
- dependency-free foundation tests and representative migration fixtures.

Authentication, cloud storage, realtime transport, guest links, and production editing are **not implemented** at this checkpoint.

## Repository map

```text
apps/web/                 React read-only board-model proof
apps/api/                 Fastify service boundary and health metadata
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

Open `http://localhost:5173`. The toolbar is deliberately non-interactive and labeled as a model proof; this prevents a polished mockup from being mistaken for durable editing.

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

M3.2 should implement authentication, workspace/board metadata, and a durable board repository behind the API. Use the capability matrix on every server mutation. A single-user save/reopen flow with version creation and recovery is the acceptance gate before realtime work begins.
