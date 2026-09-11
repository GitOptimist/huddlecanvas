# M3.4 staging authentication and deployment

This milestone deploys the Hosted Alpha as one HTTPS application: the Fastify
service serves both the React build and `/api`. Keeping them on one origin lets
HuddleCanvas use an `HttpOnly`, `Secure`, `SameSite=Lax` session cookie instead
of exposing identity-provider tokens to browser storage.

The supplied `render.yaml` creates one staging web service and one private
PostgreSQL database. Auth0 is the documented OIDC example, but the application
uses standard discovery, Authorization Code + PKCE, state, nonce, and verified
ID-token claims, so another conforming managed OIDC provider can be substituted.

## 1. Create the OIDC application

In Auth0, create a **Regular Web Application** for the staging environment.
Record its tenant issuer URL, client ID, and client secret. Enable a connection
that supplies the `openid profile email` scopes and verified email claims.

After Render assigns the service URL, configure Auth0 with this callback:

```text
https://YOUR-STAGING-HOST/api/v1/auth/callback
```

Do not add a wildcard callback. Do not put the client secret in GitHub or in
browser code.

## 2. Create the Render Blueprint

1. In Render, create a new Blueprint from the HuddleCanvas repository.
2. Select the `m3/hosted-alpha` branch and the root `render.yaml`.
3. When prompted, provide:
   - `HUDDLECANVAS_PUBLIC_ORIGIN`: the final `https://...onrender.com` origin,
     with no trailing path.
   - `HUDDLECANVAS_OIDC_ISSUER`: the exact issuer from OIDC discovery.
   - `HUDDLECANVAS_OIDC_CLIENT_ID`: the Regular Web Application client ID.
   - `HUDDLECANVAS_OIDC_CLIENT_SECRET`: its secret.
4. Confirm that Render generated `HUDDLECANVAS_SESSION_SECRET`; never replace it
   during ordinary redeployments because existing sessions depend on it.
5. Add the final callback URL to Auth0, then deploy again if the first login
   attempt occurred before the callback was registered.

The database is private (`ipAllowList: []`) and reaches the web service through
Render's internal connection string. Development sign-in is explicitly off.

## 3. Staging acceptance gate

Complete this gate before beginning realtime collaboration:

1. Open staging in Chrome and sign in through the hosted identity provider.
2. Create a board, rename it, add and move notes, and wait for **Saved**.
3. Reload the page and confirm the same board and revision return.
4. Sign out; confirm a protected API request returns `401`.
5. Sign in from Edge or Firefox with the same account; confirm the same
   workspace and board appear.
6. Edit in browser A, then edit the stale copy in browser B; confirm the second
   browser shows **Newer server copy** instead of silently overwriting data.
7. Restart the Render web service and reopen the board; confirm data survives.
8. Restore an earlier version and confirm the revision increases.
9. Confirm `/health` reports `persistence: "postgresql"` and `/api/v1/meta`
   reports `browserOidc: true`, `multiInstanceStorage: true`, and
   `realtime: false`.

Passing this gate proves authentication, authorization, autosave conflict
handling, PostgreSQL recovery, and restart durability. It does not claim
realtime collaboration.

## Rollback

Disable automatic deploys, redeploy the last known-good Render commit, and keep
the PostgreSQL database. Schema changes for this milestone are additive; do not
delete the database during an application rollback. If login configuration is
wrong, correct the four OIDC environment values and redeploy rather than
enabling development sign-in.
