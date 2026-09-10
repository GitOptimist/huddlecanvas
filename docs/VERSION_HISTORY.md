# Version history and source map

This repository preserves the historical prototype source files that were available from the project conversation.

| Version | Working name | Main progression | Archive path |
|---|---|---|---|
| v1 | FlowBoard | Basic portable whiteboard | `archive/v1-flowboard/index.html` |
| v1 portable | FlowBoard Portable | Shareable single-file package | `archive/v1-portable/index.html` |
| v2 | FlowBoard Pro | Faster vector history, palettes, autosave, editable board files | `archive/v2-pro/index.html` |
| v3 | FlowBoard Studio | Multi-board workspace, text fix, fullscreen timer, action/AI UI | `archive/v3-studio/index.html` |
| v4 | FlowBoard research build | PDF export, paste/annotation, pro icons/templates, research direction | `archive/v4-research/index.html` |
| v5 | GETITECH Board | GETITECH branding and UI refinement | `archive/v5-getitech-board/index.html` |
| v6 | Getitech Canvas | Board management, centering, pens/backgrounds/work-over-content improvements | `archive/v6-getitech-canvas/index.html` |
| v7 | Getitech Canvas | Facilitation, grouping/checklist/vote/QA expansion | `archive/v7-getitech-canvas/index.html` |
| v8 | HuddleCanvas | Working rebrand, bulk board management, advanced selection/shapes/frames/AI quiz prototypes | `archive/v8-huddlecanvas/index.html` |

The root `index.html` is a copy of the current v8 prototype.

## Post-v8 prototype improvements

- Added accessible toast notifications used by prototype actions.
- Added a contextual text-object toolbar with edit, color, bold, duplicate, delete, alt text, layer ordering, lock/unlock, and four-corner resize controls.
- Added persistent text width, height, weight, accessibility description, and lock fields while retaining defaults for existing saved boards.
- Added professional workshop markers, pre-placement sticky colors, searchable categorized templates, three business templates, a canvas context menu, and fit-to-content controls.
- Preserved the compact HuddleCanvas tool model rather than copying a dense consumer whiteboard ribbon; new controls appear contextually and use consistent inline SVG iconography.
- Refined the contextual text toolbar and overflow menu with a unified SVG icon system, stronger spacing and hierarchy, accessible pressed/expanded states, and polished professional tooltips.
- Rebuilt portable voting as a five-vote local workshop flow with per-object toggles, remaining-vote feedback, an explicit exit, safe checklist controls, confirmed vote reset, and undoable board-content reset. Context menus now adapt above or below their anchor to avoid header clipping.
- Repaired lasso selection so dragging works across genuine empty board surfaces, displays a stable screen-space selection rectangle at every zoom level, preserves Shift-added selections, selects complete groups, cancels cleanly on pointer interruption, and clears with Escape. The Select hint now describes the real interaction and dismisses automatically.
- Replaced the basic auto-arrange action with a professional contextual Arrange menu covering six-edge alignment, horizontal/vertical distribution, four-step layer ordering, and reusable object locking. Locked objects now show a standard lock marker and are protected from edits and destructive selection actions until unlocked.
- Separated the temporary lasso from persistent presentation frames: the lasso is now a blue dashed, explicitly labeled selection marquee, while frames use solid presentation chrome, a permanent FRAME title tab, and clearer tool guidance.

## M3.1 Hosted Alpha foundation

- Preserved the portable v8 baseline at tag `prototype-v8` and opened the production workstream on `m3/hosted-alpha`.
- Added a React/TypeScript monorepo shell without changing the root prototype.
- Added canonical board schema v1, validation, deterministic serialization, migrations and a read-only v8 importer with explicit loss reporting.
- Added pure command/geometry foundations, including lock enforcement, connector cleanup and spatial lasso selection independent of frame objects.
- Added a capability-based role policy, documented API/realtime boundaries, architecture decisions, CI, fixtures and automated foundation tests.
- Kept the UI honest: the new professional model proof is read-only until authentication, persistence and authoritative editing exist.

Historical files are for traceability and regression/reference. New feature work should target the root app or the future Hosted Alpha branch, not the archive.
