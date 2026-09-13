# v8-to-hosted bridge: preview and guarded board import

The original HuddleCanvas v8 and Hosted Alpha are different applications. V8 is a single HTML file backed by each browser's `localStorage`; Hosted Alpha uses authenticated workspaces, PostgreSQL, and a canonical board document. Copying v8 HTML over the Render staging service would remove hosted sign-in and durable board behavior. This bridge keeps the two products separate while moving compatible content into the hosted repository.

## Original v8 preview (separate Render static site)

The root `index.html` remains unchanged. `pnpm build:v8-preview` copies that file byte-for-byte to `dist/v8-preview/index.html`. In Render, **create a new Blueprint**, from the `m3/hosted-alpha` branch, and enter `deploy/render-v8-preview.yaml` as the Blueprint path. Review its resource type and any quoted cost before approving. The new static site is named `huddlecanvas-v8-preview`; it does **not** replace the existing `render.yaml` Blueprint, `huddlecanvas-staging` web/API service, OIDC settings, or database. Its public URL is assigned by Render, and may differ if that name is taken. Do not add the preview URL to Auth0: the v8 preview has no hosted authentication.

The preview starts with an empty _browser-local_ workspace, even if the original GitHub Pages v8 site has boards. Browser storage is scoped by origin. To test with a familiar board, open the GitHub Pages v8 app in the browser that contains it, select the board, use **Export → Download editable .flowboard**, then open the new preview and use v8 **Import**. This merely copies data between two separate local browser stores; it does not create an authenticated hosted board. Keep the downloaded file as a backup.

## Import one v8 board into Hosted Alpha

1. From the original v8 interface, export the current board as `.flowboard`. Keep that source file intact.
2. Sign in to `https://huddlecanvas-staging.onrender.com/` as a workspace owner or editor. Wait for any pending hosted save to finish.
3. Click **Import v8 board** under Your boards, select the `.flowboard`, and review the preview. The browser reads the file locally and checks for content the hosted editor cannot safely represent.
4. Only when the preview reports no unsupported content, click **Import as new board**. The API checks it again under the signed-in user's permissions, creates a **new** hosted board and revision 1, and opens it. The original v8 file and any other hosted board are left alone.
5. Inspect all imported objects, then reload and reopen the board. Check that the content and revision persist before retiring any browser-local copy.

This first narrow import accepts a single board of simple notes, text, freehand strokes, and supported vector shapes. It rejects unsupported content instead of silently dropping it: media, actions, checklists, frames, quizzes, stamps, arrows, grouped objects, votes, comments, saved v8 checkpoints, private brainstorming, custom branding, unknown fields, and malformed coordinates. A rejected file is **not** imported. A `.flowboard` larger than 750 KB is also rejected before upload. Metadata such as the original local creation timestamp is not preserved; the hosted board has new ownership, timestamps and version history. This is a content migration, not a copy of an existing browser identity or local storage.

## Next development slices

- Bring the v8 layout, navigation, toolbars and actual tool behaviors into the authenticated hosted app, using the canonical board API rather than localStorage. Compare against the root v8 prototype with browser acceptance tests; avoid cosmetic controls that do nothing.
- Extend the board model and renderer for frames, structured actions/checklists/quizzes, stamps, voting, comments, private mode and custom branding. Introduce explicit transforms and tests before accepting those files in the importer.
- Add an authenticated media upload pipeline and bind imported media to durable assets. Provide preservation of original checkpoints only when version/restore semantics are defined.
- Test on staging with a real exported board, desktop interactions, reload, cross-browser sign-in, and ownership/roles. Do not treat an exact-look static preview as completion of these hosted gates.

This bridge does not sync GitHub Pages to Render, does not ship the full v8 UI behind hosted auth, and does not alter the existing staging deployment until its branch is updated through the normal review/push/deploy workflow.
