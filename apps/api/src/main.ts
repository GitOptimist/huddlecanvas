import { randomBytes } from "node:crypto";
import { resolve } from "node:path";

import { Pool } from "pg";

import {
  CompositeIdentityVerifier,
  OidcIdentityVerifier,
  SessionSigner,
  type IdentityVerifier,
} from "./auth.ts";
import { StandardOidcClient } from "./browser-oidc.ts";
import { PostgresBoardRepository } from "./postgres-repository.ts";
import {
  BoardRepository,
  JsonFileStorage,
  type BoardRepositoryPort,
} from "./repository.ts";
import { DEVELOPMENT_SECRET, buildServer } from "./server.ts";

const production = process.env.NODE_ENV === "production";
const allowDevAuth =
  process.env.HUDDLECANVAS_ALLOW_DEV_AUTH === "true" || !production;
const configuredSecret = process.env.HUDDLECANVAS_SESSION_SECRET;

if (production && !configuredSecret) {
  throw new Error(
    "HUDDLECANVAS_SESSION_SECRET is required in production so browser sessions survive restarts.",
  );
}

const signer = new SessionSigner(
  configuredSecret ??
    (production ? randomBytes(32).toString("base64url") : DEVELOPMENT_SECRET),
);

const oidcIssuer = process.env.HUDDLECANVAS_OIDC_ISSUER;
const oidcBearerValues = [
  process.env.HUDDLECANVAS_OIDC_AUDIENCE,
  process.env.HUDDLECANVAS_OIDC_JWKS_URI,
];
if (
  oidcBearerValues.some(Boolean) &&
  (!oidcIssuer || !oidcBearerValues.every(Boolean))
) {
  throw new Error(
    "HUDDLECANVAS_OIDC_ISSUER, HUDDLECANVAS_OIDC_AUDIENCE, and HUDDLECANVAS_OIDC_JWKS_URI must be configured together.",
  );
}

let identityVerifier: IdentityVerifier = signer;
if (oidcIssuer && oidcBearerValues.every(Boolean)) {
  const oidc = new OidcIdentityVerifier({
    issuer: oidcIssuer,
    audience: oidcBearerValues[0]!,
    jwksUri: oidcBearerValues[1]!,
  });
  identityVerifier = allowDevAuth
    ? new CompositeIdentityVerifier([signer, oidc])
    : oidc;
}

const browserOidcValues = [
  oidcIssuer,
  process.env.HUDDLECANVAS_OIDC_CLIENT_ID,
  process.env.HUDDLECANVAS_OIDC_CLIENT_SECRET,
  process.env.HUDDLECANVAS_PUBLIC_ORIGIN,
];
if (browserOidcValues.some(Boolean) && !browserOidcValues.every(Boolean)) {
  throw new Error(
    "HUDDLECANVAS_OIDC_ISSUER, HUDDLECANVAS_OIDC_CLIENT_ID, HUDDLECANVAS_OIDC_CLIENT_SECRET, and HUDDLECANVAS_PUBLIC_ORIGIN must be configured together for browser sign-in.",
  );
}

const publicOrigin = browserOidcValues[3];
if (publicOrigin) {
  const parsedOrigin = new URL(publicOrigin);
  if (parsedOrigin.origin !== parsedOrigin.href.replace(/\/$/, "")) {
    throw new Error(
      "HUDDLECANVAS_PUBLIC_ORIGIN must not include a path, query, or fragment.",
    );
  }
  const loopback =
    parsedOrigin.hostname === "127.0.0.1" ||
    parsedOrigin.hostname === "localhost";
  if (parsedOrigin.protocol !== "https:" && !loopback) {
    throw new Error(
      "HUDDLECANVAS_PUBLIC_ORIGIN must use HTTPS outside local development.",
    );
  }
}

const browserOidc = browserOidcValues.every(Boolean)
  ? new StandardOidcClient({
      issuer: browserOidcValues[0]!,
      clientId: browserOidcValues[1]!,
      clientSecret: browserOidcValues[2]!,
    })
  : undefined;

if (production && !browserOidc && !allowDevAuth) {
  throw new Error(
    "Production requires browser OIDC configuration when development sign-in is disabled.",
  );
}

const dataFile = resolve(
  process.env.HUDDLECANVAS_DATA_FILE ?? ".data/huddlecanvas.json",
);
const databaseUrl = process.env.DATABASE_URL;
const persistence =
  process.env.HUDDLECANVAS_PERSISTENCE ?? (databaseUrl ? "postgresql" : "file");

let repository: BoardRepositoryPort;
if (persistence === "postgresql") {
  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL is required when HUDDLECANVAS_PERSISTENCE=postgresql.",
    );
  }
  repository = new PostgresBoardRepository(
    new Pool({ connectionString: databaseUrl }),
    {
      migrate: process.env.HUDDLECANVAS_RUN_MIGRATIONS !== "false",
      closePool: true,
    },
  );
} else if (persistence === "file") {
  repository = new BoardRepository(new JsonFileStorage(dataFile));
} else {
  throw new Error(
    "HUDDLECANVAS_PERSISTENCE must be either 'file' or 'postgresql'.",
  );
}

const server = buildServer({
  repository,
  signer,
  identityVerifier,
  ...(browserOidc ? { browserOidc } : {}),
  ...(publicOrigin ? { publicOrigin } : {}),
  oidcCallbackPath:
    process.env.HUDDLECANVAS_OIDC_CALLBACK_PATH ?? "/api/v1/auth/callback",
  transactionSecret: configuredSecret ?? DEVELOPMENT_SECRET,
  ...(production || process.env.HUDDLECANVAS_WEB_DIST
    ? {
        staticDirectory: resolve(
          process.env.HUDDLECANVAS_WEB_DIST ?? "apps/web/dist",
        ),
      }
    : {}),
  allowDevAuth,
  logger: process.env.HUDDLECANVAS_LOGGER !== "false",
});
const port = Number(process.env.PORT ?? 3001);
const host = process.env.HOST ?? "0.0.0.0";

await server.listen({ host, port });

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    void server.close().finally(() => process.exit(0));
  });
}
