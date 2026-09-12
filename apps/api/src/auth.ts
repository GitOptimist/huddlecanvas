import { createHmac, timingSafeEqual } from "node:crypto";

import type { FastifyRequest } from "fastify";
import { createRemoteJWKSet, jwtVerify } from "jose";

export interface SessionIdentity {
  userId: string;
  email: string;
  displayName: string;
}

export interface ExternalIdentity {
  externalSubject: string;
  email: string;
  displayName: string;
}

export type VerifiedIdentity = SessionIdentity | ExternalIdentity;

export interface IdentityVerifier {
  readonly kind: "local" | "oidc" | "composite";
  verify(
    token: string,
    currentTime?: number,
  ): VerifiedIdentity | Promise<VerifiedIdentity>;
}

interface SessionPayload extends SessionIdentity {
  issuedAt: number;
  expiresAt: number;
}

export type AuthenticationErrorCode =
  "authentication_failed" | "email_unverified";

export class AuthenticationError extends Error {
  readonly code: AuthenticationErrorCode;

  constructor(
    message = "Authentication is required.",
    code: AuthenticationErrorCode = "authentication_failed",
  ) {
    super(message);
    this.name = "AuthenticationError";
    this.code = code;
  }
}

function encode(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decode(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

export class SessionSigner implements IdentityVerifier {
  readonly kind = "local" as const;
  private readonly secret: string;
  private readonly lifetimeSeconds: number;

  constructor(secret: string, lifetimeSeconds = 8 * 60 * 60) {
    if (secret.length < 24) {
      throw new Error("Session secret must contain at least 24 characters.");
    }
    this.secret = secret;
    this.lifetimeSeconds = lifetimeSeconds;
  }

  issue(identity: SessionIdentity, currentTime = Date.now()): string {
    const issuedAt = Math.floor(currentTime / 1000);
    const payload: SessionPayload = {
      ...identity,
      issuedAt,
      expiresAt: issuedAt + this.lifetimeSeconds,
    };
    const encodedPayload = encode(JSON.stringify(payload));
    return `${encodedPayload}.${this.sign(encodedPayload)}`;
  }

  verify(token: string, currentTime = Date.now()): SessionIdentity {
    const [encodedPayload, suppliedSignature, extra] = token.split(".");
    if (!encodedPayload || !suppliedSignature || extra) {
      throw new AuthenticationError("Session token is malformed.");
    }
    const expectedSignature = this.sign(encodedPayload);
    const supplied = Buffer.from(suppliedSignature, "utf8");
    const expected = Buffer.from(expectedSignature, "utf8");
    if (
      supplied.length !== expected.length ||
      !timingSafeEqual(supplied, expected)
    ) {
      throw new AuthenticationError("Session token is invalid.");
    }

    let payload: SessionPayload;
    try {
      payload = JSON.parse(decode(encodedPayload)) as SessionPayload;
    } catch {
      throw new AuthenticationError("Session token payload is invalid.");
    }
    if (
      typeof payload.userId !== "string" ||
      typeof payload.email !== "string" ||
      typeof payload.displayName !== "string" ||
      typeof payload.expiresAt !== "number"
    ) {
      throw new AuthenticationError("Session token payload is incomplete.");
    }
    if (payload.expiresAt <= Math.floor(currentTime / 1000)) {
      throw new AuthenticationError("Session has expired.");
    }
    return {
      userId: payload.userId,
      email: payload.email,
      displayName: payload.displayName,
    };
  }

  private sign(value: string): string {
    return createHmac("sha256", this.secret).update(value).digest("base64url");
  }
}

export interface OidcIdentityVerifierOptions {
  issuer: string;
  audience: string;
  jwksUri: string;
}

export class OidcIdentityVerifier implements IdentityVerifier {
  readonly kind = "oidc" as const;
  private readonly issuer: string;
  private readonly audience: string;
  private readonly jwks: ReturnType<typeof createRemoteJWKSet>;

  constructor(options: OidcIdentityVerifierOptions) {
    this.issuer = options.issuer;
    this.audience = options.audience;
    const jwksUrl = new URL(options.jwksUri);
    const loopback =
      jwksUrl.hostname === "127.0.0.1" || jwksUrl.hostname === "localhost";
    if (jwksUrl.protocol !== "https:" && !loopback) {
      throw new Error(
        "OIDC JWKS URI must use HTTPS outside local development.",
      );
    }
    this.jwks = createRemoteJWKSet(jwksUrl);
  }

  async verify(
    token: string,
    currentTime = Date.now(),
  ): Promise<ExternalIdentity> {
    try {
      const { payload } = await jwtVerify(token, this.jwks, {
        issuer: this.issuer,
        audience: this.audience,
        algorithms: ["RS256", "PS256", "ES256"],
        currentDate: new Date(currentTime),
      });
      if (!payload.sub) {
        throw new AuthenticationError("Identity token is missing its subject.");
      }
      if (typeof payload.email !== "string" || !payload.email.trim()) {
        throw new AuthenticationError(
          "Identity token is missing an email address.",
        );
      }
      if (payload.email_verified !== true) {
        throw new AuthenticationError(
          "Identity token must contain a verified email address.",
        );
      }
      const displayName =
        typeof payload.name === "string" && payload.name.trim()
          ? payload.name.trim()
          : payload.email.split("@")[0] || "HuddleCanvas user";
      return {
        externalSubject: `${this.issuer}|${payload.sub}`,
        email: payload.email.trim().toLowerCase(),
        displayName,
      };
    } catch (error) {
      if (error instanceof AuthenticationError) throw error;
      throw new AuthenticationError("Identity token is invalid or expired.");
    }
  }
}

export class CompositeIdentityVerifier implements IdentityVerifier {
  readonly kind = "composite" as const;
  private readonly verifiers: readonly IdentityVerifier[];

  constructor(verifiers: readonly IdentityVerifier[]) {
    if (!verifiers.length)
      throw new Error("At least one identity verifier is required.");
    this.verifiers = verifiers;
  }

  async verify(
    token: string,
    currentTime = Date.now(),
  ): Promise<VerifiedIdentity> {
    for (const verifier of this.verifiers) {
      try {
        return await verifier.verify(token, currentTime);
      } catch (error) {
        if (!(error instanceof AuthenticationError)) throw error;
      }
    }
    throw new AuthenticationError("Session token is invalid or expired.");
  }
}

export async function requireIdentity(
  request: FastifyRequest,
  verifier: IdentityVerifier,
): Promise<VerifiedIdentity> {
  const header = request.headers.authorization;
  if (!header?.startsWith("Bearer ")) throw new AuthenticationError();
  return verifier.verify(header.slice("Bearer ".length));
}
