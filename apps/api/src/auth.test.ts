import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";

import {
  SignJWT,
  exportJWK,
  generateKeyPair,
  type CryptoKey,
  type JWK,
} from "jose";

import { AuthenticationError, OidcIdentityVerifier } from "./auth.ts";

async function oidcFixture() {
  const { privateKey, publicKey } = await generateKeyPair("RS256", {
    extractable: true,
  });
  const jwk: JWK = {
    ...(await exportJWK(publicKey)),
    kid: "huddlecanvas-test-key",
    use: "sig",
    alg: "RS256",
  };
  const server = createServer((_request, response) => {
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify({ keys: [jwk] }));
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const issuer = "https://identity.example.test";
  const audience = "huddlecanvas-api";
  const verifier = new OidcIdentityVerifier({
    issuer,
    audience,
    jwksUri: `http://127.0.0.1:${address.port}/.well-known/jwks.json`,
  });

  async function token(
    claims: Record<string, unknown> = {},
    key: CryptoKey = privateKey,
  ) {
    return new SignJWT({
      email: "alex@example.com",
      email_verified: true,
      name: "Alex Rivera",
      ...claims,
    })
      .setProtectedHeader({ alg: "RS256", kid: "huddlecanvas-test-key" })
      .setIssuer(issuer)
      .setAudience(audience)
      .setSubject("identity-123")
      .setIssuedAt()
      .setExpirationTime("5m")
      .sign(key);
  }

  return {
    verifier,
    token,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

test("OIDC verifier validates signature, claims, and verified email", async () => {
  const fixture = await oidcFixture();
  try {
    const identity = await fixture.verifier.verify(await fixture.token());
    assert.deepEqual(identity, {
      externalSubject: "https://identity.example.test|identity-123",
      email: "alex@example.com",
      displayName: "Alex Rivera",
    });

    await assert.rejects(
      fixture.verifier.verify(await fixture.token({ email_verified: false })),
      AuthenticationError,
    );
    await assert.rejects(
      fixture.verifier.verify(
        await fixture.token({ email_verified: undefined }),
      ),
      AuthenticationError,
    );

    await assert.rejects(
      fixture.verifier.verify(
        await new SignJWT({ email: "alex@example.com" })
          .setProtectedHeader({ alg: "RS256", kid: "huddlecanvas-test-key" })
          .setIssuer("https://wrong-issuer.example.test")
          .setAudience("huddlecanvas-api")
          .setSubject("identity-123")
          .setExpirationTime("5m")
          .sign((await generateKeyPair("RS256")).privateKey),
      ),
      AuthenticationError,
    );
  } finally {
    await fixture.close();
  }
});
