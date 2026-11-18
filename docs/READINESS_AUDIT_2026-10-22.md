# HuddleCanvas cross-functional readiness audit

**Date:** 22 October 2026

**Updated:** 18 November 2026

**Release under review:** M3.5.1 — Hosted Alpha Trust Hardening
**Product promise:** the fastest trustworthy path from workshop evidence to a durable decision, owner and follow-up.

## Executive finding

HuddleCanvas is a credible authenticated, cloud-saved **single-account alpha**. It is not yet a collaborative whiteboard and must not claim feature superiority over Microsoft Whiteboard, Miro, FigJam, Mural or Lucidspark. Its strongest route to differentiation is not a larger toolbar; it is a shorter, more reliable workflow from brainstorm to decision to accountable action.

The immediate release is intentionally bounded. It improves trust without changing the database schema, migrating v8 boards or rewriting existing customer data. Realtime collaboration, invitations, participant-aware facilitation and the canonical outcome model are sequenced into the next milestones.

## Experience benchmark from the reference boards

The supplied Miro and Web Whiteboard screens are quality references, not a product specification to copy. HuddleCanvas should adopt their strongest interaction conventions while producing a calmer, outcome-led workspace.

| Adopt as a quality baseline                                               | Improve for HuddleCanvas                                                                                              | Explicitly reject                                                                 |
| ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| A large, unobstructed canvas with compact floating controls               | Keep brainstorm, decision, owner and follow-up states connected instead of presenting an undifferentiated blank board | Launch-time sales promotions and product-update interstitials                     |
| A small persistent tool rail plus searchable discovery for advanced tools | Show a purpose, shortcut and clear result for every tool; rank tools by the current workshop phase                    | A marketplace-sized catalogue in the primary creation path                        |
| Standard global icons, visible names, shortcuts and contextual inspectors | Use plain-language labels and disclose Preview or Planned capability honestly                                         | Decorative or generic AI affordances that do not perform a reliable canvas action |
| Role/use-case onboarding and templates                                    | Make onboarding skippable, progressive and tailored to the user's immediate outcome                                   | Forced questionnaires before a user can reach their board                         |
| Clear share, save, account, zoom and help states                          | Keep status visible without stealing canvas space or implying unavailable collaboration                               | A permanently open chat rail that narrows the working area                        |
| Keyboard, touch and responsive access to core actions                     | Treat accessibility and recovery as product capabilities, not post-launch polish                                      | Hidden mobile navigation and pointer-only object manipulation                     |

This release implements the safety-critical portion of that standard: truthful controls, clearer status and navigation, standard SVG controls, responsive workspace navigation, accessible dialogs and keyboard canvas-object selection/nudging. Searchable tool discovery, progressive onboarding and contextual outcome guidance belong in M3.6/M3.7 after the shared-board foundation is authoritative.

## Cross-functional criticism

| Discipline               | What is strong                                                                                                                                                  | Critical gap                                                                                                                                           | Required response                                                                                                                       |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| PM / PO                  | Clear brainstorm → organize → vote → decide → assign → follow-up thesis; broad v8 workflow coverage                                                             | Backlog previously mixed research prototypes with shipped capabilities and encouraged feature-count competition                                        | Use capability labels, milestone exit criteria and the outcome-loop north star; never market hidden prototypes as hosted features       |
| Architecture             | OIDC with PKCE/state/nonce, verified email, race-safe identity binding, secure cookie session, PostgreSQL readiness, optimistic revisions and account isolation | Two persistence models remain: account-level v8 workspace and canonical board documents; no realtime or shared membership workflow                     | Preserve v8 data now; converge on canonical collaborative boards in M3.6 behind explicit import/migration tooling                       |
| QA / QC                  | Unit, API, persistence, bridge, type and build suites cover core durability and security behavior                                                               | Browser coverage was Chromium-only and local browser binaries are not guaranteed                                                                       | Run Chromium, Firefox and WebKit in CI; require staging signup, save/reload, isolation, export and rollback smoke evidence              |
| UI / UX                  | Compact canvas model, contextual controls, GETITECH branding and strong workshop primitives                                                                     | Hosted copy exposed unavailable collaboration and generic AI affordances; mobile navigation, dialogs and canvas objects needed stronger access         | Hide unavailable entries, use standard SVG controls, add mobile navigation, dialog focus handling and keyboard canvas selection/nudging |
| Security                 | Server-side identity, origin checks, no browser secrets, content security policy, payload cap and revision conflicts                                            | Authentication endpoints lacked abuse controls; request IDs and selected headers were absent; dependency advisories were open; v8 validation was broad | Add rate limits, server-generated request IDs, HSTS/Permissions-Policy, patched dependencies and bounded recursive validation           |
| Engineering              | Monorepo boundaries, repository adapters, tests and Render Blueprint make the code portable                                                                     | Generated bridge behavior and source behavior can drift; deployment checks did not trigger for all relevant files                                      | Keep generated assets reproducible, test truthfulness transformations and expand CI path coverage                                       |
| Reliability / Operations | Same-origin web/API service, health endpoint and database persistence are deployable on Render                                                                  | No formal release/rollback evidence, service-level objectives or production telemetry                                                                  | Use the release gate, preserve a known-good commit, add error/latency/save-conflict telemetry before wider beta                         |
| R&D synthesis            | The product has a defensible outcome-oriented wedge                                                                                                             | Shipping realtime, AI and a data-model migration together would create unacceptable recovery risk                                                      | Approve trust hardening now; sequence collaboration foundation before outcome-loop expansion                                            |

## Competitive reality

Competitors make realtime presence, guest entry, voting/private contribution, comments and facilitation controls table stakes. HuddleCanvas should not attempt to win by copying every diagram shape or adding a generic chat panel.

| Capability                             | HuddleCanvas M3.5.1                                             | Microsoft Whiteboard                 | Miro                                | FigJam                              | Mural                               | Lucidspark                          |
| -------------------------------------- | --------------------------------------------------------------- | ------------------------------------ | ----------------------------------- | ----------------------------------- | ----------------------------------- | ----------------------------------- |
| Cloud account persistence              | Yes, one signed-in account workspace                            | Yes                                  | Yes                                 | Yes                                 | Yes                                 | Yes                                 |
| Realtime co-editing and presence       | No                                                              | Yes                                  | Yes                                 | Yes                                 | Yes                                 | Yes                                 |
| Guest or invite workflow               | No                                                              | Microsoft-account/Teams dependent    | Yes                                 | Yes, including visitor flows        | Yes                                 | Yes, including guest collaborators  |
| Participant-aware voting/private input | Single-account preview only                                     | Reactions support lightweight voting | Yes                                 | Yes                                 | Yes                                 | Yes                                 |
| Timer and facilitation                 | Timer and local workflow controls                               | Follow and meeting workflows         | Yes                                 | Yes                                 | Yes                                 | Yes, including facilitator controls |
| Durable decision → owner → follow-up   | Prototype action cards; not a server-authoritative outcome loop | General canvas/task ecosystem        | Integrations and workshop workflows | Action-oriented meeting workflows   | Workshop workflows and integrations | Visual collaboration/integrations   |
| Defensible opportunity                 | Purpose-built outcome loop                                      | Microsoft ecosystem                  | Breadth and platform ecosystem      | Figma ecosystem and approachability | Facilitation depth                  | Diagram/workflow ecosystem          |

Official product references reviewed:

- Microsoft Whiteboard features and Teams collaboration: <https://support.microsoft.com/whiteboard>
- Miro workshops, private mode, voting and timer: <https://help.miro.com/hc/en-us/categories/360001914100>
- FigJam meetings, voting and guest collaboration: <https://www.figma.com/figjam/>
- Mural facilitation, private mode, voting and timer: <https://www.mural.co/features>
- Lucidspark guest collaboration, voting and facilitator tools: <https://help.lucid.co/hc/en-us/categories/14652573187476-Lucidspark>

## Approved milestone sequence

### M3.5.1 — Hosted Alpha Trust Hardening

- Direct **Create account** entry through the configured OIDC provider.
- Accurate hosted copy and no visible unimplemented AI/collaboration entry points.
- Standard SVG controls, accessible labels and visible keyboard focus.
- Patched Fastify dependency chain and a zero-known-vulnerability production audit.
- Login/signup/global rate limits, request correlation and security headers.
- Backward-compatible v8 validation for depth, node count, strings, numbers, cycles and payload size.
- Race-safe identity provisioning, bounded database readiness checks, server-owned canonical audit metadata and nested canonical document validation.
- Mobile workspace navigation, accessible dialogs and keyboard canvas-object selection/nudging in the hosted v8 bridge.
- CI triggers for application, bridge, dependency, Blueprint and lockfile changes.
- Chromium, Firefox and WebKit workflow gates in CI.

### M3.6 — Canonical Collaborative Board Foundation

Exit criteria:

1. Two authenticated users can join the same board through an invitation.
2. Both can edit concurrently, see presence and recover after reconnect without silent loss.
3. Roles are enforced on every mutation and guest access has expiry/revocation.
4. Existing v8 workspaces remain readable and exportable; migration is explicit, observable and reversible.
5. Media moves to object storage with authorization, quotas and lifecycle controls.

### M3.7 — Outcome Loop

Exit criteria:

1. Private contribution and reveal are participant-aware, not visual masking on one account.
2. Votes have participant identity/limits and a facilitator-controlled lifecycle.
3. A decision is a first-class server object linked to evidence on the canvas.
4. Actions are assigned to real workspace members with due dates, status and **My actions**.
5. Comments, mentions and notifications are authoritative and auditable.
6. The board produces a durable decision summary and follow-up view without manual transcription.

### M4 — Differentiation and scale

- Canvas-native, permission-aware AI actions only after evaluation, audit and cost controls exist.
- Microsoft Whiteboard import research using representative exports/APIs.
- Teams, Slack, Jira, Drive and OneDrive integrations selected by customer evidence.
- Enterprise SSO/SCIM, audit, retention, legal hold, data residency and administration.
- Performance budgets, board virtualization and large-workshop load testing.

## Product measures

- Time from board creation to first recorded decision.
- Percentage of sessions ending with at least one decision and named owner.
- Action completion rate within seven days.
- Save success, conflict, reconnect recovery and data-loss rate.
- Guest join success and median time to contribute.
- Weekly return rate to outcome/follow-up views.

## Additional recommendations

1. Recruit five facilitator-led design partners and observe complete workshops, including follow-up one week later.
2. Establish a public capability matrix with **Available**, **Preview** and **Planned** labels.
3. Add product analytics only with explicit privacy rules; measure workflow outcomes, not canvas surveillance.
4. Complete trademark/domain clearance for HuddleCanvas before public launch.
5. Define service objectives before beta: save availability, save latency, reconnect recovery and restore time.
6. Commission an independent penetration test after sharing/realtime is implemented and before external beta.
7. Move rate-limit state to shared Key Value storage before increasing the Render service beyond one instance.

## Release decision

**Approved for Hosted Alpha after every gate in `docs/HOSTED_ALPHA_RELEASE_GATE.md` passes.** This approval does not extend to a collaborative-beta or “better than Microsoft Whiteboard” marketing claim.
