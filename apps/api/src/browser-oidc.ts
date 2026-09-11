import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

import { createRemoteJWKSet, jwtVerify } from "jose";

import { AuthenticationError, type ExternalIdentity } from "./auth.ts";

const TRANSACTION_LIFETIME_SECONDS = 10 * 60;

export interface OidcTransaction {
  state: string;
  nonce: string;
  codeVerifier: string;
  returnTo: string;
  createdAt: number;
}

export interface BrowserOidcClient {
  createAuthorizationRequest(input: {
    redirectUri: string;
    returnTo: string;
  }): Promise<{ url: string; transaction: OidcTransaction }>;
  completeAuthorization(input: {
    callbackUrl: string;
    redirectUri: string;
    transaction: OidcTransaction;
  }): Promise<ExternalIdentity>;
}

interface OidcDiscoveryDocument {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
  userinfo_endpoint?: string;
  token_endpoint_auth_methods_supported?: string[];
}

interface StandardOidcClientOptions {
  issuer: string;
  clientId: string;
  clientSecret: string;
  fetch?: typeof fetch;
}

function randomValue(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

function codeChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

function normalizedIssuer(value: string): string {
  return value.replace(/\/$/, "");
}

function safeEndpoint(value: string, field: string): URL {
  const url = new URL(value);
  const loopback = url.hostname === "127.0.0.1" || url.hostname === "localhost";
  if (url.protocol !== "https:" && !loopback) {
    throw new Error(`${field} must use HTTPS outside local development.`);
  }
  return url;
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new AuthenticationError(
      "The identity provider returned an invalid response.",
    );
  }
  return value as Record<string, unknown>;
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function safeReturnTo(value: unknown): string {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//")
  ) {
    return "/";
  }
  if (value.includes("\\") || /[\r\n]/.test(value)) return "/";
  return value;
}

export class OidcTransactionCodec {
  private readonly secret: string;

  constructor(secret: string) {
    if (secret.length < 24) {
      throw new Error(
        "OIDC transaction secret must contain at least 24 characters.",
      );
    }
    this.secret = secret;
  }

  issue(transaction: OidcTransaction): string {
    const encoded = Buffer.from(JSON.stringify(transaction), "utf8").toString(
      "base64url",
    );
    const signature = createHmac("sha256", this.secret)
      .update(encoded)
      .digest("base64url");
    return `${encoded}.${signature}`;
  }

  verify(value: string, currentTime = Date.now()): OidcTransaction {
    const [encoded, suppliedSignature, extra] = value.split(".");
    if (!encoded || !suppliedSignature || extra) {
      throw new AuthenticationError("The sign-in transaction is malformed.");
    }
    const expectedSignature = createHmac("sha256", this.secret)
      .update(encoded)
      .digest("base64url");
    const supplied = Buffer.from(suppliedSignature, "utf8");
    const expected = Buffer.from(expectedSignature, "utf8");
    if (
      supplied.length !== expected.length ||
      !timingSafeEqual(supplied, expected)
    ) {
      throw new AuthenticationError("The sign-in transaction is invalid.");
    }

    let transaction: OidcTransaction;
    try {
      transaction = JSON.parse(
        Buffer.from(encoded, "base64url").toString("utf8"),
      ) as OidcTransaction;
    } catch {
      throw new AuthenticationError("The sign-in transaction is invalid.");
    }
    if (
      !text(transaction.state) ||
      !text(transaction.nonce) ||
      !text(transaction.codeVerifier) ||
      !text(transaction.returnTo) ||
      typeof transaction.createdAt !== "number"
    ) {
      throw new AuthenticationError("The sign-in transaction is incomplete.");
    }
    const ageSeconds = (currentTime - transaction.createdAt) / 1000;
    if (ageSeconds < 0 || ageSeconds > TRANSACTION_LIFETIME_SECONDS) {
      throw new AuthenticationError("The sign-in transaction has expired.");
    }
    return { ...transaction, returnTo: safeReturnTo(transaction.returnTo) };
  }
}

export class StandardOidcClient implements BrowserOidcClient {
  private readonly issuer: string;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly request: typeof fetch;
  private discoveryPromise?: Promise<OidcDiscoveryDocument>;

  constructor(options: StandardOidcClientOptions) {
    this.issuer = options.issuer;
    safeEndpoint(this.issuer, "OIDC issuer");
    this.clientId = options.clientId;
    this.clientSecret = options.clientSecret;
    this.request = options.fetch ?? fetch;
  }

  async createAuthorizationRequest(input: {
    redirectUri: string;
    returnTo: string;
  }): Promise<{ url: string; transaction: OidcTransaction }> {
    const discovery = await this.discovery();
    const transaction: OidcTransaction = {
      state: randomValue(),
      nonce: randomValue(),
      codeVerifier: randomValue(48),
      returnTo: safeReturnTo(input.returnTo),
      createdAt: Date.now(),
    };
    const authorizationUrl = safeEndpoint(
      discovery.authorization_endpoint,
      "OIDC authorization endpoint",
    );
    authorizationUrl.search = new URLSearchParams({
      response_type: "code",
      client_id: this.clientId,
      redirect_uri: input.redirectUri,
      scope: "openid profile email",
      code_challenge: codeChallenge(transaction.codeVerifier),
      code_challenge_method: "S256",
      state: transaction.state,
      nonce: transaction.nonce,
    }).toString();
    return { url: authorizationUrl.href, transaction };
  }

  async completeAuthorization(input: {
    callbackUrl: string;
    redirectUri: string;
    transaction: OidcTransaction;
  }): Promise<ExternalIdentity> {
    const callback = new URL(input.callbackUrl);
    const providerError = callback.searchParams.get("error");
    if (providerError) {
      throw new AuthenticationError("Sign-in was cancelled or rejected.");
    }
    const suppliedState = callback.searchParams.get("state");
    const code = callback.searchParams.get("code");
    if (suppliedState !== input.transaction.state || !code) {
      throw new AuthenticationError("The sign-in response is invalid.");
    }

    const discovery = await this.discovery();
    const tokenEndpoint = safeEndpoint(
      discovery.token_endpoint,
      "OIDC token endpoint",
    );
    const form = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: input.redirectUri,
      code_verifier: input.transaction.codeVerifier,
    });
    const headers = new Headers({
      accept: "application/json",
      "content-type": "application/x-www-form-urlencoded",
    });
    const authMethods = discovery.token_endpoint_auth_methods_supported ?? [
      "client_secret_basic",
    ];
    if (authMethods.includes("client_secret_basic")) {
      headers.set(
        "authorization",
        `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`, "utf8").toString("base64")}`,
      );
      form.set("client_id", this.clientId);
    } else if (authMethods.includes("client_secret_post")) {
      form.set("client_id", this.clientId);
      form.set("client_secret", this.clientSecret);
    } else {
      throw new AuthenticationError(
        "The identity provider does not support a compatible client authentication method.",
      );
    }

    const tokenResponse = await this.request(tokenEndpoint, {
      method: "POST",
      headers,
      body: form,
    });
    const tokenPayload = object(await tokenResponse.json().catch(() => null));
    if (!tokenResponse.ok) {
      throw new AuthenticationError(
        "The identity provider rejected the sign-in code.",
      );
    }
    const idToken = text(tokenPayload.id_token);
    if (!idToken) {
      throw new AuthenticationError(
        "The identity provider did not return an ID token.",
      );
    }

    const { payload } = await jwtVerify(
      idToken,
      createRemoteJWKSet(safeEndpoint(discovery.jwks_uri, "OIDC JWKS URI")),
      {
        issuer: discovery.issuer,
        audience: this.clientId,
        algorithms: ["RS256", "PS256", "ES256"],
      },
    ).catch(() => {
      throw new AuthenticationError(
        "The identity provider returned an invalid ID token.",
      );
    });
    if (payload.nonce !== input.transaction.nonce || !payload.sub) {
      throw new AuthenticationError("The identity token failed validation.");
    }

    let claims: Record<string, unknown> = payload;
    const email = text(claims.email);
    if (
      (!email || claims.email_verified !== true) &&
      discovery.userinfo_endpoint
    ) {
      const accessToken = text(tokenPayload.access_token);
      if (accessToken) {
        const userInfoResponse = await this.request(
          safeEndpoint(discovery.userinfo_endpoint, "OIDC user-info endpoint"),
          { headers: { authorization: `Bearer ${accessToken}` } },
        );
        if (userInfoResponse.ok) {
          const userInfo = object(
            await userInfoResponse.json().catch(() => null),
          );
          if (userInfo.sub === payload.sub) claims = { ...claims, ...userInfo };
        }
      }
    }

    const verifiedEmail = text(claims.email);
    if (!verifiedEmail || claims.email_verified !== true) {
      throw new AuthenticationError(
        "The identity provider must supply a verified email address.",
      );
    }
    const displayName =
      text(claims.name) ??
      text(claims.preferred_username) ??
      verifiedEmail.split("@")[0] ??
      "HuddleCanvas user";
    return {
      externalSubject: `${normalizedIssuer(discovery.issuer)}|${payload.sub}`,
      email: verifiedEmail.toLowerCase(),
      displayName,
    };
  }

  private discovery(): Promise<OidcDiscoveryDocument> {
    this.discoveryPromise ??= this.loadDiscovery();
    return this.discoveryPromise;
  }

  private async loadDiscovery(): Promise<OidcDiscoveryDocument> {
    const endpoint = safeEndpoint(
      `${normalizedIssuer(this.issuer)}/.well-known/openid-configuration`,
      "OIDC discovery endpoint",
    );
    const response = await this.request(endpoint, {
      headers: { accept: "application/json" },
    });
    if (!response.ok) {
      throw new Error("OIDC discovery failed.");
    }
    const document = object(await response.json().catch(() => null));
    if (
      normalizedIssuer(String(document.issuer ?? "")) !==
        normalizedIssuer(this.issuer) ||
      !text(document.authorization_endpoint) ||
      !text(document.token_endpoint) ||
      !text(document.jwks_uri)
    ) {
      throw new Error(
        "OIDC discovery returned incomplete or mismatched metadata.",
      );
    }
    return document as unknown as OidcDiscoveryDocument;
  }
}
