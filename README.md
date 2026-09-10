# HuddleCanvas by GETITECH

**Working product name:** HuddleCanvas  
**Positioning:** Collaborate · Decide · Deliver  
**Current prototype:** v8, static single-file browser application

**Hosted workstream:** M3.1 production foundation in `apps/` and `packages/`

HuddleCanvas is a collaborative visual workspace being developed by GETITECH. The prototype evolved from a simple Microsoft Whiteboard-style canvas into a broader facilitation and execution product with multi-board management, templates, ink, images, PDF/PNG export, grouping, voting, checklists, frames/presentation concepts, AI-assisted quiz creation prototypes, and facilitation workflows.

## Run the preserved v8 prototype

You can double-click `index.html`, but running a local web server is more reliable for development:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000` in your browser.

## Repository layout

```text
index.html                         Current v8 prototype
apps/web/                          Hosted Alpha React application shell
apps/api/                          Hosted API boundary
apps/realtime/                     Realtime protocol boundary
packages/board-schema/             Canonical schema, validation, migration/import
packages/canvas-core/              Pure board commands and selection geometry
packages/authz/                    Server-oriented role/capability policy
tests/e2e/                         Hosted application smoke tests
assets/                            GETITECH logo source images
archive/                           Historical code snapshots v1-v8
docs/                              Product, deployment, VS Code, Codex, and project context
.github/workflows/deploy-pages.yml GitHub Pages deployment
AGENTS.md                          Instructions for Codex/AI coding agents
.nojekyll                          Prevents Jekyll processing on Pages
```

## Run the Hosted Alpha foundation

The first M3 checkpoint is now scaffolded without replacing the v8 prototype:

```bash
corepack enable
pnpm install
pnpm test:foundation
pnpm --filter @huddlecanvas/web dev
```

Open `http://localhost:5173`. The hosted shell is a deliberately read-only proof that the canonical schema can drive a professional interface. Authentication, durable storage, realtime transport, and production editing are not yet represented as working features.

See `docs/HOSTED_ALPHA_DEVELOPMENT.md` and the architecture decisions in `docs/adr/`.

## Important current architecture constraint

The prototype is intentionally self-contained and stores board state in browser `localStorage`. It does **not** yet have production authentication, cloud persistence, realtime collaboration, a database, billing, or a live AI model backend. Those are part of the Hosted Alpha milestone.

## Hosted Alpha path

The production workstream is moving toward a **Hosted Alpha** with:

- React + TypeScript frontend
- canonical board object/schema layer
- authentication and organizations/workspaces
- cloud database + object storage
- realtime shared document layer
- guest collaboration permissions
- server-side AI gateway
- version history/recovery
- analytics, billing entitlements, and production QA

The current checkpoint establishes the schema, importer, command, geometry, authorization, and application-shell boundaries. The next vertical slice is authenticated workspace metadata plus durable single-user save/reopen and recovery. See `docs/WORK_PROJECT_CONTEXT.md`, `docs/PRODUCT_PROJECT_TRACKER.md`, and `docs/HOSTED_ALPHA_DEVELOPMENT.md` before significant changes.
