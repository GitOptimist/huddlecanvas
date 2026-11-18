# Hosted Alpha release gate

Use this checklist for every deployment to `huddlecanvas-staging`. A release is complete only when automated checks and live staging evidence pass.

## Automated gate

Run from the repository root:

```bash
pnpm install --frozen-lockfile
pnpm audit --prod --audit-level=moderate
pnpm check
pnpm --filter @huddlecanvas/e2e exec playwright install --with-deps chromium firefox webkit
pnpm test:e2e
```

Required result:

- Production dependency audit reports no known vulnerabilities at moderate or higher severity.
- Foundation, API, OIDC, classic-workspace and hosted bridge tests pass.
- TypeScript and production builds pass.
- Chromium, Firefox and WebKit pass the hosted workflows.
- Browser workflows prove mobile board navigation, dialog focus/return and keyboard object selection/nudging in the default hosted v8 experience.

## Live staging gate

Test in a private browser session against <https://huddlecanvas-staging.onrender.com/>.

1. The signed-out screen shows **Sign in** and **Create account**.
2. **Create account** opens the identity provider in signup mode.
3. A new user must verify their email before HuddleCanvas accepts the identity.
4. Create or rename a board, add a sticky note and ink, then wait for **Saved to your account**.
5. Reload and confirm the exact board, text and ink return.
6. Sign out; confirm the app returns to the signed-out screen and protected API requests fail.
7. Sign in as a different account; confirm the first account's workspace is not visible.
8. Confirm Export PDF, PNG and editable `.flowboard` download complete.
9. At 1440 px and 390 px widths, verify the canvas remains usable with no page-level horizontal overflow.
10. Confirm no visible AI, Collaborate or Bring everyone controls imply unavailable service behavior.
11. Confirm `/health` returns HTTP 200 and reports PostgreSQL persistence.
12. Review Render deploy logs for migrations, startup errors and repeated HTTP 5xx responses.

## Security evidence

- Session cookie is `Secure`, `HttpOnly`, `SameSite=Lax`, host-only and cleared on sign-out.
- OIDC uses authorization code, PKCE, state, nonce and verified email.
- Responses include a server-generated `x-request-id`, CSP, `X-Content-Type-Options`, referrer policy, frame policy, Permissions-Policy and HSTS on HTTPS.
- Login and signup return HTTP 429 after their configured per-minute thresholds.
- Concurrent first-login attempts cannot rebind an established verified email to a different external subject.
- `/health` performs a bounded persistence probe and returns HTTP 503 when PostgreSQL is unavailable.
- Classic workspaces reject malformed, cyclic, excessive-depth, excessive-node, unsafe-number and over-10-MiB payloads.
- Canonical board saves enforce nested point/style/object limits and server-owned object audit identities.
- No secret, token or provider credential appears in browser source or logs.

## Data-safety constraints

- M3.5.1 has no database schema migration and no automatic v8-to-canonical conversion.
- Existing account workspaces are structurally preserved apart from normal v8 default-field normalization already present in the editor; this release performs no conversion or migration.
- Generated `assets/v8-hosted.html` and `assets/v8-hosted.js` must come from `scripts/build-v8-hosted.mjs`; do not edit generated assets directly.
- Any future migration requires a dry run, count/reconciliation report, downloadable backup and tested rollback.

## Rollback

Known-good pre-hardening application commit: `3bec2663b625202c990cd9608666204e6ad156e5`.

1. Stop promotion if GitHub checks or any live staging gate fails.
2. In Render, redeploy the known-good commit for `huddlecanvas-staging`.
3. Re-run health, sign-in and save/reload smoke tests.
4. Preserve failing logs and request IDs; do not delete or rewrite user workspaces.
5. Open a blocking issue with impact, reproduction, affected commit and recovery evidence.

## External configuration still required

- Use a customer-facing Auth0 tenant/domain and HuddleCanvas/GETITECH branding instead of an internal development tenant name.
- Configure production support, privacy and terms links on the identity-provider screens.
- Rotate OIDC/session secrets under an approved incident or credential-rotation procedure; never copy them into repository files.
