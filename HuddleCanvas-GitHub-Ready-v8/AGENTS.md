# AGENTS.md — HuddleCanvas engineering instructions

## Product objective
Build HuddleCanvas into a polished collaborative visual workspace owned by GETITECH. The product should feel simpler to enter than feature-dense whiteboards while being stronger at facilitation and follow-through. Core product flow:

**Brainstorm → Organize → Vote → Decide → Assign → Follow up**

## Current state
- Root `index.html` is the v8 prototype and canonical demo.
- It is a single static HTML file with embedded CSS/JS and an embedded GETITECH logo.
- Data is stored locally in browser `localStorage`.
- AI behavior in the prototype is local/mock utility logic; there is no production model backend.
- `archive/` is historical reference only. Do not edit old snapshots unless explicitly asked.

## Branding
- Working product name: **HuddleCanvas** (provisional until naming clearance).
- Owner: GETITECH.
- Current brand colors: primary `#6256D9`, secondary `#312E81`.
- Keep GETITECH ownership visible without turning the product UI into a corporate website.
- Avoid novice-looking emoji/generic iconography. Prefer consistent SVG icon systems and contextual controls.

## Engineering rules
1. Create a Git checkpoint before a non-trivial change.
2. Preserve existing working behavior unless the change explicitly replaces it.
3. Prefer contextual UI over adding permanent toolbar clutter.
4. Do not put API keys or secrets in browser code. Production AI must use a server-side gateway.
5. Do not claim realtime collaboration, cloud persistence, or security features unless they are actually implemented.
6. For prototype fixes, keep dependencies at zero unless adding a dependency clearly reduces risk.
7. For the Hosted Alpha refactor, create a separate branch and migrate incrementally rather than rewriting the only working prototype in place.
8. Treat accessibility, keyboard operation, touch/stylus input, and responsive layout as release criteria, not cleanup.

## Prototype QA checklist
Before accepting a change to `index.html`:
- Load with no JavaScript console errors.
- Create, rename, duplicate, delete, and switch boards.
- Verify long board lists scroll without moving canvas controls.
- Draw with each pen preset, highlighter, eraser, and shapes.
- Add/edit/move template notes and write ink over them.
- Paste/import an image and annotate over it.
- Test select/lasso, group/ungroup, duplicate, delete, and vote behavior.
- Test checklist interaction.
- Test background presets + custom background + return to white.
- Test focus mode exit with button and Escape.
- Test timer stop/close and fullscreen restore.
- Test PNG/PDF/editable-board export.
- Test at minimum Chrome/Edge; then Safari/Firefox before a release.

## Production milestone direction
The next major engineering milestone should be Hosted Alpha, not endless single-file expansion. Suggested architecture:
- React + TypeScript
- board scene graph/object schema separated from rendering
- realtime CRDT/shared document layer
- backend API for auth, boards, workspaces, permissions, billing, AI
- PostgreSQL + object storage
- websocket/realtime presence
- secure server-side AI tool execution
- automated unit/integration/e2e tests

## Context files
Read these before larger tasks:
- `docs/WORK_PROJECT_CONTEXT.md`
- `docs/PRODUCT_PROJECT_TRACKER.md`
- `docs/VERSION_HISTORY.md`
- `docs/CODEX_IN_VSCODE.md`
