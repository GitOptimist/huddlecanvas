# HuddleCanvas by GETITECH

**Working product name:** HuddleCanvas  
**Positioning:** Collaborate · Decide · Deliver  
**Current prototype:** v8, static single-file browser application

HuddleCanvas is a collaborative visual workspace being developed by GETITECH. The prototype evolved from a simple Microsoft Whiteboard-style canvas into a broader facilitation and execution product with multi-board management, templates, ink, images, PDF/PNG export, grouping, voting, checklists, frames/presentation concepts, AI-assisted quiz creation prototypes, and facilitation workflows.

## Run locally

You can double-click `index.html`, but running a local web server is more reliable for development:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000` in your browser.

## Repository layout

```text
index.html                         Current v8 prototype
assets/                            GETITECH logo source images
archive/                           Historical code snapshots v1-v8
docs/                              Product, deployment, VS Code, Codex, and project context
.github/workflows/deploy-pages.yml GitHub Pages deployment
AGENTS.md                          Instructions for Codex/AI coding agents
.nojekyll                          Prevents Jekyll processing on Pages
```

## Important current architecture constraint

The prototype is intentionally self-contained and stores board state in browser `localStorage`. It does **not** yet have production authentication, cloud persistence, realtime collaboration, a database, billing, or a live AI model backend. Those are part of the Hosted Alpha milestone.

## Recommended next milestone

Move from prototype iteration to a **Hosted Alpha** with:

- React + TypeScript frontend
- canonical board object/schema layer
- authentication and organizations/workspaces
- cloud database + object storage
- realtime shared document layer
- guest collaboration permissions
- server-side AI gateway
- version history/recovery
- analytics, billing entitlements, and production QA

See `docs/WORK_PROJECT_CONTEXT.md` and `docs/PRODUCT_PROJECT_TRACKER.md` before starting significant changes.
