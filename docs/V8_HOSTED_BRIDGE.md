# v8 interface in Hosted Alpha

Hosted Alpha now opens the working v8 interface after authentication. The root `index.html` remains the preserved source. During the web build, `scripts/build-v8-hosted.mjs` copies its document exactly and changes only the startup, persistence, and native prompt wiring required by the hosted shell.

The public flow is:

1. Open `https://huddlecanvas-staging.onrender.com/` and sign in through the existing OIDC flow.
2. The React account shell loads that user's v8 workspace from `GET /api/v1/classic-workspace`.
3. The v8 interface runs in a restricted frame without access to the session cookie, bearer token, parent storage, or network APIs.
4. v8 save events are sent to the parent shell. The parent saves them with an authenticated, revision-checked `PUT /api/v1/classic-workspace`.
5. Sign out flushes pending changes before ending the hosted session.

Each account has one complete v8 workspace record. It preserves boards, notes, text, strokes, shapes, media data, templates placed on boards, branding, votes, comments, and local checkpoints as represented by v8. PostgreSQL uses an atomic revision check so two open tabs cannot silently overwrite one another. A conflict leaves the local tab open and offers a workspace backup before reloading the cloud copy. The API rejects invalid structures and payloads larger than 10 MiB.

The earlier canonical Hosted Alpha editor and its boards remain available from **Earlier alpha boards** or `/?editor=alpha`. Its board records are not rewritten or deleted. The v8 workspace is stored separately because its full data model contains features the canonical editor does not yet represent.

## Existing v8 data

Browser storage cannot be copied automatically between the preview and staging origins. To move an existing preview board, open `https://huddlecanvas-v8-preview.onrender.com/`, download the editable `.flowboard`, sign in to Hosted Alpha, and import it through the v8 interface. Keep the downloaded file as a backup until the imported board has saved and survived a reload.

## Security and release checks

- Authentication stays in the parent React application and Fastify API.
- The v8 frame never receives authentication credentials.
- The frame accepts initialization only from its parent; the parent accepts workspace messages only from its own frame.
- A content security policy blocks frame network requests and external framing.
- API tests cover authentication, account isolation, validation, durable file recovery, PostgreSQL storage, and stale-revision conflicts.
- Browser tests cover v8 creation, account save, reload persistence, sign-out, second-account isolation, and the earlier canonical editor regressions.

The separate v8 preview remains a browser-local demo. Hosted Alpha is the authenticated account-backed version.
