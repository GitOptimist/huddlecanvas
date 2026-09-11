import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";

import { SignJWT, exportJWK, generateKeyPair, type JWK } from "jose";

import { AuthenticationError } from "./auth.ts";
import {
  OidcTransactionCodec,
  StandardOidcClient,
  safeReturnTo,
} from "./browser-oidc.ts";

test("OIDC browser flow uses discovery, PKCE, state, nonce, and verified claims", async () => {
  const { privateKey, publicKey } = await generateKeyPair("RS256", {
    extractable: true,
  });
  const jwk: JWK = {
    ...(await exportJWK(publicKey)),
    kid: "browser-flow-key",
    use: "sig",
    alg: "RS256",
  };
  let issuer = "";
  let expectedNonce = "";
  let tokenRequest = "";
  const provider = createServer(async (request, response) => {
    response.setHeader("content-type", "application/json");
    if (request.url === "/.well-known/openid-configuration") {
      response.end(
        JSON.stringify({
          issuer,
          authorization_endpoint: `${issuer}/authorize`,
          token_endpoint: `${issuer}/oauth/token`,
          jwks_uri: `${issuer}/.well-known/jwks.json`,
          token_endpoint_auth_methods_supported: ["client_secret_basic"],
        }),
      );
      return;
    }
    if (request.url === "/.well-known/jwks.json") {
      response.end(JSON.stringify({ keys: [jwk] }));
      return;
    }
    if (request.url === "/oauth/token" && request.method === "POST") {
      for await (const chunk of request) tokenRequest += chunk.toString();
      const idToken = await new SignJWT({
        email: "hosted@example.com",
        email_verified: true,
        name: "Hosted Alpha",
        nonce: expectedNonce,
      })
        .setProtectedHeader({ alg: "RS256", kid: "browser-flow-key" })
        .setIssuer(issuer)
        .setAudience("huddlecanvas-client")
        .setSubject("hosted-user-1")
        .setIssuedAt()
        .setExpirationTime("5m")
        .sign(privateKey);
      response.end(
        JSON.stringify({ id_token: idToken, access_token: "access" }),
      );
      return;
    }
    response.statusCode = 404;
    response.end(JSON.stringify({ error: "not_found" }));
  });
  await new Promise<void>((resolve, reject) => {
    provider.once("error", reject);
    provider.listen(0, "127.0.0.1", resolve);
  });
  const address = provider.address();
  assert.ok(address && typeof address !== "string");
  issuer = `http://127.0.0.1:${address.port}`;

  try {
    const client = new StandardOidcClient({
      issuer,
      clientId: "huddlecanvas-client",
      clientSecret: "client-secret",
    });
    const redirectUri = "http://127.0.0.1:3001/api/v1/auth/callback";
    const authorization = await client.createAuthorizationRequest({
      redirectUri,
      returnTo: "/boards/board-1",
    });
    expectedNonce = authorization.transaction.nonce;
    const authorizationUrl = new URL(authorization.url);
    assert.equal(authorizationUrl.origin, issuer);
    assert.equal(authorizationUrl.searchParams.get("response_type"), "code");
    assert.equal(
      authorizationUrl.searchParams.get("code_challenge_method"),
      "S256",
    );
    assert.ok(authorizationUrl.searchParams.get("code_challenge"));
    assert.equal(
      authorizationUrl.searchParams.get("state"),
      authorization.transaction.state,
    );

    const identity = await client.completeAuthorization({
      callbackUrl: `${redirectUri}?code=single-use-code&state=${authorization.transaction.state}`,
      redirectUri,
      transaction: authorization.transaction,
    });
    assert.deepEqual(identity, {
      externalSubject: `${issuer}|hosted-user-1`,
      email: "hosted@example.com",
      displayName: "Hosted Alpha",
    });
    const submitted = new URLSearchParams(tokenRequest);
    assert.equal(submitted.get("code"), "single-use-code");
    assert.equal(
      submitted.get("code_verifier"),
      authorization.transaction.codeVerifier,
    );

    await assert.rejects(
      client.completeAuthorization({
        callbackUrl: `${redirectUri}?code=single-use-code&state=wrong-state`,
        redirectUri,
        transaction: authorization.transaction,
      }),
      AuthenticationError,
    );
  } finally {
    await new Promise<void>((resolve) => provider.close(() => resolve()));
  }
});

test("OIDC transaction cookies reject tampering, expiry, and unsafe return paths", () => {
  const now = Date.UTC(2026, 8, 11, 12, 0, 0);
  const codec = new OidcTransactionCodec("test-transaction-secret-12345");
  const transaction = {
    state: "state",
    nonce: "nonce",
    codeVerifier: "verifier",
    returnTo: "/boards/one",
    createdAt: now,
  };
  const encoded = codec.issue(transaction);
  assert.deepEqual(codec.verify(encoded, now + 60_000), transaction);
  assert.throws(
    () => codec.verify(`${encoded.slice(0, -1)}x`, now + 60_000),
    AuthenticationError,
  );
  assert.throws(
    () => codec.verify(encoded, now + 11 * 60_000),
    AuthenticationError,
  );
  assert.equal(safeReturnTo("//attacker.example"), "/");
  assert.equal(safeReturnTo("/safe/path?tab=one"), "/safe/path?tab=one");
});
