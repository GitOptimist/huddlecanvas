# HuddleCanvas by GETITECH — Product & Project Tracker

**Tagline:** Collaborate · Decide · Deliver  
**Version:** v8 Research Build  
**Date:** 25 August 2026  
**Status:** Product prototype / hosted foundation next

> **Working-name note:** “HuddleCanvas” is a provisional product name. Complete formal trademark, domain and marketplace clearance before public launch.

## 1. Product summary

HuddleCanvas is a visual collaboration workspace designed to move teams from open-ended thinking to accountable execution. The target experience is easier to enter than feature-heavy whiteboards, stronger at workshop facilitation than a blank canvas, and more useful after the meeting because decisions become owners, tasks and follow-up.

**Positioning:** A collaborative canvas where teams brainstorm, organize, vote, decide, assign and follow through — without losing the natural feel of an infinite whiteboard.

**Core workflow:** Idea → Cluster → Vote → Decide → Action → Owner → Done.

### Target users
- Product, project, operations and strategy teams.
- Facilitators, consultants and transformation leaders.
- Educators and trainers using interactive boards and quizzes.
- Client-facing teams needing low-friction guest participation.
- Enterprise teams needing governance, SSO, auditability and optional BYO AI.

### Product principles
1. **Power underneath; simplicity on the surface.** Keep the persistent toolbar small and reveal advanced actions contextually.
2. **Facilitation is first class.** Timer, voting, private brainstorm, reveal and presentation are core workflows.
3. **Execution follows collaboration.** Decisions should become actions, owners and due dates.
4. **AI acts on the canvas.** AI should organize selected objects, generate quizzes/diagrams, extract actions and create follow-ups — not only chat.
5. **Trust over novelty.** Autosave, recovery, export fidelity, privacy, accessibility and predictable controls are core product quality.

## 2. Current status

### v8 implemented / prototyped
- Multi-board workspace and bulk board management.
- GETITECH ownership mark + HuddleCanvas working identity.
- Ink, highlighter, eraser, backgrounds, images/screenshots and ink-over-objects.
- Lasso/multi-select, Group/Ungroup, basic scale/rotate, snapping, alignment/distribution, layer ordering and object locking prototypes.
- Shape popover: rectangle, rounded rectangle, ellipse, triangle, diamond, hexagon, star and arrow/connector.
- Voting, checklists, action cards and private-brainstorm/reveal prototype.
- Frames + local presentation mode.
- Visually distinct lasso and frame workflows: temporary blue selection marquee versus persistent, titled presentation regions.
- Local search, named checkpoints and local comments/@mentions prototype.
- AI local utilities, including quiz cards generated from selected board text.
- PNG, PDF and editable `.flowboard` export; image paste/drag/import.

### Not yet production/hosted
- Authentication, organizations/workspaces and cloud persistence.
- Realtime CRDT collaboration, live cursors and presence.
- Guest links and enforceable roles/permissions.
- Production AI model connection and secure AI gateway.
- Direct PDF page rendering/import.
- Billing, subscriptions, entitlements and analytics.
- Signed Windows/macOS packages with auto-update.
- SSO, audit, retention and enterprise data controls.

### QA note
Static JavaScript syntax and literal DOM-ID checks pass. Automated browser navigation was blocked in the build environment, so full interactive cross-browser regression remains a required manual/release QA step.

## 3. v8 interaction guide

### Vote
1. Choose **Vote**.
2. Click a card/object to add one local vote; click it again to remove that vote.
3. Allocate up to five votes across distinct objects.
4. Choose **Done voting** to return to Select.
5. Use **Facilitate → Reset votes** to clear all votes.

### Checklist
Choose **Checklist**, click the canvas, edit the title/items and tick rows as work is completed.

### Group / Ungroup
Choose **Select**. Drag across empty canvas to select several objects, or Shift-click drag handles to add more. The contextual Selection bar exposes **Group**, **Ungroup**, **Arrange**, scale, rotate, comment, duplicate and delete.

### Arrange / Lock
Select one or more objects and choose **Arrange** in the contextual Selection bar. Align two or more objects, distribute three or more objects, change front/back layer order, or lock objects against editing and accidental destructive actions. Select a locked object and return to **Arrange** to unlock it; for a single text object, use **More actions → Unlock**.

### AI quiz
Select relevant content → open **HuddleCanvas AI** → **Quiz from selected**. The portable build creates editable local quiz cards. Production AI can generate semantic questions, distractors, explanations, difficulty and scoring.

## 4. Deployment & commercial model

### Deployment recommendation
- Primary SaaS: `canvas.getitechsolutions.com` or a subdomain based on the final cleared product name.
- Marketing/download tracking: product page on `getitechsolutions.com` with download, activation and conversion analytics.
- Education vertical: `board.getitechacademy.com` can route educators/learners into the same product with education templates/pricing.
- Desktop: Windows/macOS companions should use the same account, boards and subscription as web.

### Pricing hypothesis — validate with customers
| Tier | Price target | Value hypothesis |
|---|---:|---|
| Free | $0 | 3–5 editable cloud boards, core canvas/templates, PNG/PDF, limited history, basic guest access, small AI trial |
| Pro | $8–12/user/mo | Unlimited/private boards, cloud sync, deeper history, PDF import, frames, premium templates, AI credits |
| Team | $12–18/user/mo | Realtime multiplayer, guests, comments, voting/private brainstorm, shared templates/admin, more AI |
| Business / Enterprise | Custom | SSO/SCIM, audit, retention, roles, data controls, integrations, BYO AI, higher limits/SLA |

Competitive benchmark checked 25 Aug 2026: Miro Free lists 3 editable boards, Starter $8/member/month annually and Business $20/member/month annually. Figma Professional lists $16/month for a Full seat and $3/month for a Collab seat.

### AI model
- Managed AI by default with included credits/limits.
- BYO AI as Business/Enterprise capability.
- Provider credentials are stored server-side in a secure secrets system — never in browser HTML/localStorage.
- Meter expensive AI actions separately from normal canvas usage.

## 5. Production architecture

- **Frontend:** React + TypeScript, design system, scene graph/canvas engine, responsive + stylus/touch modes.
- **Document model:** Versioned schema for strokes, shapes, text, media, frames, comments, votes, tasks and metadata.
- **Realtime:** WebSocket transport + CRDT/shared-document semantics for conflict-free editing, presence and reconnect recovery.
- **Backend API:** Users, orgs, workspaces, boards, templates, roles, comments, versions, billing, exports and integrations.
- **Data:** PostgreSQL + object storage + realtime cache/presence layer.
- **AI gateway:** Server-side model router, secure credentials, quotas, selected-object context builder and action permissions.
- **Desktop:** Tauri/Electron wrapper around canonical web product with auto-update/native file handling.
- **Security:** Encryption, least privilege, SSO/SAML/SCIM, audit, retention/deletion/export and rate controls.
- **Observability:** Product analytics, error reporting, traces, AI cost/latency and collaboration health.

## 6. Milestones

| Milestone | Scope | Status |
|---|---|---|
| M0 — Concept | v1–v3 MVP, faster ink, branding, multi-board concept | Complete |
| M1 — Product shell | v4–v6 research UI, PDF export, paste/images, backgrounds, board management | Complete |
| M2 — Facilitation & object productivity | v7–v8 voting, checklists, grouping/lasso, shapes, frames, search, AI quiz prototype | Current / prototype |
| M3 — Hosted Alpha | Auth, cloud storage, realtime CRDT/presence, guest links, roles, recovery | Next |
| M4 — Pro Beta | PDF import, production AI, billing, comments/notifications, desktop beta | Planned |
| M5 — Public Launch | Onboarding, analytics, pricing, support, security/accessibility/cross-browser QA | Planned |
| M6 — Enterprise | SSO/SCIM, audit/retention, BYO AI, admin/data controls | Planned |

### M3 definition of done
Two authenticated users can open the same cloud board, edit concurrently without data loss, see presence, recover after disconnect, invite a guest with scoped permission, and revisit the board from another device. Hosted app passes baseline Chrome/Edge/Safari regression and autosave/recovery tests.

## 7. Prioritized backlog

### P0 — Hosted product viability
- React/TypeScript production application.
- Versioned scene graph/object schema + migrations.
- Authentication, organizations, workspaces and server-enforced roles.
- Cloud board/media storage, autosave and recovery.
- Realtime CRDT/shared document + presence.
- Guest links with expiry/passcode/domain options.
- Production lasso/resize/rotate/nested grouping engine.
- Smart connectors, snapping guides, alignment/distribution and auto-layout.
- PDF page import + annotation.
- Secure AI gateway and selected-object actions.
- Billing, subscriptions, credits and entitlements.
- Observability, error reporting and performance budgets.

### P1 — Adoption/differentiation
- Anonymous voting, private mode, reveal and facilitator follow/bring-everyone.
- Comments, @mentions and notifications.
- Frames/presenter mode with navigation and notes.
- Version history + named checkpoints + workspace search.
- Team template studio/publishing.
- Microsoft Whiteboard migration assistant.
- Windows/macOS packages + auto-update.
- Accessibility / keyboard / screen-reader QA.
- Slack/Teams/Jira/Drive/OneDrive integrations.

### P2 — Expansion
- Tables, timelines, mind maps and advanced auto-layout.
- UML/BPMN/cloud diagram libraries.
- Marketplace/plugins/templates ecosystem.
- Native/tablet-optimized apps.
- Admin/workshop outcome analytics.

## 8. Key risks
- **Naming:** HuddleCanvas requires legal/domain/app-store clearance.
- **Scope creep:** Freeze v8 as a research baseline; move investment to production architecture.
- **Local storage:** Portable builds can hit quota, especially with pasted images.
- **Realtime:** Reconnect/concurrent-edit edge cases require serious CRDT and failure testing.
- **AI cost/privacy:** Use quotas, secure gateway and enterprise BYO AI.
- **Microsoft import:** Do not promise perfect direct `.whiteboard` import until representative files/APIs are tested.
- **Performance:** Large boards require scene graph culling and memory/performance budgets.
- **Desktop:** Avoid separate codebases; wrap the canonical web product.

## 9. QA / definition of done
- Functional regression for create/edit/select/group/export/collaborate workflows.
- Chrome/Edge/Safari/Firefox + Windows/macOS baseline.
- Mouse, trackpad, touch and stylus input checks.
- Autosave/reconnect/conflict/undo/version recovery tests.
- Export/import fidelity.
- Accessibility and keyboard navigation.
- Server-side authorization and secrets handling.
- Performance and error telemetry.

## 10. Project context for future ChatGPT Project sessions

**North star:** HuddleCanvas by GETITECH is a web-first visual collaboration product whose differentiation is moving teams from brainstorming to decisions and execution. Keep persistent UI simple; make facilitation, structured actions and canvas-native AI the product moat.

**Current baseline:** v8 portable research build.  
**Next milestone:** M3 Hosted Alpha.  
**Rule:** Do not fake hosted functionality in portable builds; label prototypes/dependencies clearly.  
**Working name:** HuddleCanvas, pending clearance.  
**Business direction:** Free → Pro → Team → Business/Enterprise; managed AI default, BYO AI enterprise; shared web/desktop account model.  
**Distribution:** GETITECH Solutions domain/subdomain for the main product; GETITECH Academy as an education vertical.

## References checked 25 Aug 2026
- Miro pricing: https://miro.com/pricing/
- Figma pricing: https://www.figma.com/pricing/
- GETITECH Solutions: https://getitechsolutions.com/
