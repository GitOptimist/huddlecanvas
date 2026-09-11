import { randomBytes } from "node:crypto";
import { resolve } from "node:path";

import { Pool } from "pg";

import {
  CompositeIdentityVerifier,
  OidcIdentityVerifier,
  SessionSigner,
  type IdentityVerifier,
} from "./auth.ts";
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

if (production && allowDevAuth && !configuredSecret) {
  throw new Error(
    "HUDDLECANVAS_SESSION_SECRET is required when development sign-in is enabled in production.",
  );
}

const signer = new SessionSigner(
  configuredSecret ??
    (production ? randomBytes(32).toString("base64url") : DEVELOPMENT_SECRET),
);

const oidcValues = [
  process.env.HUDDLECANVAS_OIDC_ISSUER,
  process.env.HUDDLECANVAS_OIDC_AUDIENCE,
  process.env.HUDDLECANVAS_OIDC_JWKS_URI,
];
if (oidcValues.some(Boolean) && !oidcValues.every(Boolean)) {
  throw new Error(
    "HUDDLECANVAS_OIDC_ISSUER, HUDDLECANVAS_OIDC_AUDIENCE, and HUDDLECANVAS_OIDC_JWKS_URI must be configured together.",
  );
}

let identityVerifier: IdentityVerifier = signer;
if (oidcValues.every(Boolean)) {
  const oidc = new OidcIdentityVerifier({
    issuer: oidcValues[0]!,
    audience: oidcValues[1]!,
    jwksUri: oidcValues[2]!,
  });
  identityVerifier = allowDevAuth
    ? new CompositeIdentityVerifier([signer, oidc])
    : oidc;
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
  allowDevAuth,
  logger: process.env.HUDDLECANVAS_LOGGER !== "false",
});
const port = Number(process.env.PORT ?? 3001);
const host = process.env.HOST ?? "0.0.0.0";

await server.listen({ host, port });
