# Video delivery — approved scope, 19 November 2026

User requested both canvas video and live camera/microphone calls.

## Status
Foundation only: tested provider URL normalization. No video UI or live calling
is deployed. The root v8 prototype remains unchanged.

## Canvas video release
- YouTube/Vimeo link cards with explicit click-to-load consent; no provider
  requests, thumbnails or autoplay before consent.
- Persist source descriptors with board revisions; validate again on rendering.
- Move, resize, duplicate, delete, undo, reload and portable export fidelity.
- Restrict frame CSP to supported providers; no arbitrary embed HTML.
- Uploaded videos follow separately: private object storage, signed access,
  upload quotas, MIME/content inspection and lifecycle cleanup. Do not put
  video bytes into the current 10 MiB workspace JSON.

## Live calls release
- Implement shared-board invitations and server-enforced room membership first.
- Server-issued short-lived room tokens; never trust client-supplied membership.
- Explicit join/preflight, camera/mic off initially, device choice, mute,
  camera off, participant list and leave. Stop tracks on leave/unmount.
- No recording in this release. Media permission failures must not block editing.
- Select managed or self-hosted media infrastructure after evaluating costs;
  no paid provisioning without approval. Verify TURN/reconnect behavior.
- Test two distinct authenticated users, denied/revoked membership, token expiry,
  browser permissions, network interruptions and mobile layout before deployment.

## Release gates
Unit/API checks, Chromium/Firefox/WebKit workflows, authenticated persistence,
cross-account isolation, explicit media consent and live two-device call test.
Passing URL parser tests alone is not feature completion.
