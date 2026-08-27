# HuddleCanvas — context summary for a ChatGPT Work project

Use this file as the first project-context document when continuing HuddleCanvas development in ChatGPT Work.

## Product owner and intent
GETITECH is developing a commercial collaborative visual-workspace product. The project began as a request for a browser whiteboard similar in spirit to Microsoft Whiteboard, but the goal evolved into an independent product rather than a clone. The product should feel polished, facilitation-first, collaborative, and execution-oriented.

**Working product name:** HuddleCanvas by GETITECH  
**Working positioning:** Collaborate · Decide · Deliver

The name is provisional and should be cleared for trademark/domain/app-store use before launch.

## Core product thesis
Do not compete by exposing the most buttons. Combine:
1. low-friction visual creation,
2. strong meeting/workshop facilitation,
3. structured decisions/actions, and
4. AI that can act on board objects rather than merely chat beside them.

Target workflow:
**Brainstorm → Organize → Vote → Decide → Assign → Follow up**

## Evolution / relevant chat history

### v1 — FlowBoard
A self-contained HTML browser whiteboard was created with pen, highlighter, eraser, shapes, text, sticky notes, undo/redo, pan/zoom, and PNG export. It was packaged as a portable ZIP that could be shared without installation.

### v2 — FlowBoard Pro
The original canvas snapshot architecture caused pen lag. Drawing history was redesigned around lighter vector operations. Added visible color palettes, company palette, autosave, editable `.flowboard` import/export, board title, templates, grid toggle, meeting timer, and branding controls.

### v3 — FlowBoard Studio
Fixed text-tool trapping by introducing Select mode and returning to Select after text placement. Added a fullscreen animated break/focus timer, multiple boards in a sidebar, action cards, template library, command/focus concepts, and an AI Copilot UI with local-only utilities.

### v4 — research-driven build
Competitive research covered Miro, Microsoft Whiteboard, FigJam, Mural, and related products. Added PDF export, image/text paste, image annotation, more professional SVG icons, more visible interactive templates, and locked product ownership branding instead of customer white-labeling. The project identified Microsoft Whiteboard desktop-app retirement/migration as a potential acquisition opportunity while recognizing Whiteboard remains on web/Teams.

### v5 — GETITECH Board
GETITECH logo was baked into the app. Website link and stronger zoom controls were tested. Feedback showed the zoom treatment became too visually dominant and website navigation should not look like an app feature.

### v6 — Getitech Canvas
Product identity separated company ownership from product naming. Added/strengthened board management, template centering, colored pen presets, background choices, and write-over-template/image behavior.

### v7 — Getitech Canvas
Expanded board-management and QA work. Added grouping/ungrouping concepts, checklist, voting, eraser clear-ink/clear-board modes, facilitation direction, richer background behavior, and fixes for long board-list scrolling/timer close behavior.

### v8 — HuddleCanvas
The working name changed to HuddleCanvas by GETITECH. Added bulk board management, clearer vote/checklist interaction, lasso/multi-select and contextual group/ungroup controls, early resize/rotate/auto-arrange behavior, additional shape selection, frames/presentation concepts, search/version checkpoints/comments prototypes, private-brainstorm/reveal concepts, and AI quiz-generation UI/local logic. A full product/project tracker was created.

## Current prototype capabilities
The current `index.html` is a single-file static v8 prototype. It includes much of the following interaction set:
- multi-board local workspace
- create/rename/duplicate/delete boards and bulk-management concepts
- freehand pens with multiple colors
- highlighter / eraser / basic shapes
- text and sticky notes
- templates
- write/draw over template content
- paste/import images and annotate over them
- board backgrounds
- focus mode and break timer
- checklist and action cards
- selection/grouping/lasso concepts
- voting/facilitation concepts
- PDF, PNG, and editable-board export
- frames/presentation concepts
- AI panel with local/mock board utilities and quiz generation prototype

## Critical limitations — do not misrepresent these
The v8 prototype does **not** yet have production:
- user authentication
- cloud board persistence
- realtime collaborative editing/cursors
- durable guest links/permissions
- server database/object storage
- live generative AI backend
- subscription billing
- enterprise SSO/audit/retention
- complete PDF page import
- full automated cross-browser regression suite

Board persistence currently relies on browser `localStorage`, so there is no safe promise of unlimited boards. Media-heavy boards can exhaust browser storage.

## Competitive/product research conclusions
- Miro demonstrates breadth and template discovery but also the risk of feature density.
- FigJam demonstrates clean, low-friction collaboration and facilitation.
- Mural demonstrates strong facilitator controls such as private modes, voting, summon/follow, lock, reveal, and laser pointer.
- Microsoft Whiteboard demonstrates approachable ink-first UI. Its standalone apps are retiring, creating a migration/independent-workspace opportunity, but direct `.whiteboard` conversion must be validated against real files before being promised.

Product principle: **Power underneath. Simplicity on the surface.** Prefer contextual controls, selection toolbars, templates, and AI commands over permanent toolbar expansion.

## Commercial model direction
Recommended structure:
- Free: a few cloud boards, core whiteboarding/templates/exports, small AI trial.
- Pro: unlimited/private cloud boards, version history, PDF import, premium templates, presentations, included AI credits.
- Team: realtime collaboration, comments/@mentions, guest access, facilitation/voting, shared templates/admin, more AI.
- Business/Enterprise: SSO, audit/retention, governance, advanced permissions/integrations, higher limits, optional Bring Your Own AI.

BYOAI should be a power-user/enterprise option, not the default onboarding flow. Provider keys must live in secure server-side secret storage, never browser code.

## Deployment/product distribution direction
- Web should be the canonical product.
- A GETITECH-owned product subdomain is preferred for the live app.
- The current static prototype can be deployed to GitHub Pages for demos/free preview.
- Windows/macOS downloadable editions can later package the same frontend using a desktop shell such as Tauri/Electron while sharing cloud accounts and boards.
- Downloads from the GETITECH website can be instrumented for funnel analytics.

## Next recommended milestone
**Hosted Alpha** — stop expanding the single HTML file indefinitely.

Recommended technical foundation:
- React + TypeScript
- canonical board object/scene schema independent of UI
- authentication + organization/workspace model
- PostgreSQL for application data
- object storage for images/PDFs/exports
- realtime shared-document layer (CRDT-style architecture) + websocket presence
- guest roles: Owner / Editor / Commenter / Viewer / Guest Session
- version history/recovery
- secure server-side AI gateway with canvas-manipulation tools
- billing/entitlements
- automated unit/integration/e2e tests and cross-browser QA

## High-priority backlog
1. Production lasso/multi-select, resize, rotate, group/ungroup, align/distribute, lock/layers.
2. Smart connectors/snapping and diagram auto-layout.
3. Frames/presentation navigator.
4. Realtime collaboration/cursors/presence.
5. Comments, @mentions, guest links and notifications.
6. Private brainstorming/reveal, anonymous voting, facilitator bring-everyone-to-me/spotlight.
7. PDF page import/annotation.
8. Workspace search and version history.
9. AI cluster/summarize/diagram/decision/action/quiz workflows acting directly on selected board objects.
10. Microsoft Whiteboard migration assistant after real-format testing.

## QA philosophy
Treat QA as part of the product architecture. Every release should test board management, scrolling, tools, templates, write-over behavior, images, groups, backgrounds, timer/focus, export, keyboard access, local-storage failure/recovery, and responsive behavior. Before commercial release, add Chrome/Edge/Firefox/Safari coverage and automated end-to-end tests.

## How the Work project should continue
At the start of a new Work session:
1. Read this file.
2. Read `PRODUCT_PROJECT_TRACKER.md`.
3. Treat `index.html` as the current prototype baseline, not the final architecture.
4. Ask which milestone is active before making a large architectural change.
5. Preserve GETITECH ownership/branding and the product principle of simple surface + powerful contextual workflows.
6. Keep factual distinctions between prototype, implemented production feature, and future backlog.
