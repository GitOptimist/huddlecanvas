import type { BoardDocument } from "@huddlecanvas/board-schema";

export type Role =
  "owner" | "editor" | "commenter" | "viewer" | "guest-session";

export interface Identity {
  userId: string;
  email: string;
  displayName: string;
}

export interface Workspace {
  id: string;
  name: string;
  createdAt: string;
  createdBy: string;
}

export interface WorkspaceAccess {
  workspace: Workspace;
  role: Role;
}

export interface BoardMetadata {
  id: string;
  workspaceId: string;
  title: string;
  revision: number;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
}

export interface BoardRecord extends BoardMetadata {
  document: BoardDocument;
}

export interface BoardVersion {
  id: string;
  boardId: string;
  revision: number;
  document: BoardDocument;
  createdAt: string;
  createdBy: string;
  reason: string;
}

export type AuthMode = "oidc" | "development" | "unavailable";

const API_BASE = "/api";

export function hostedLoginUrl(returnTo = "/"): string {
  const query = new URLSearchParams({ returnTo });
  return `${API_BASE}/v1/auth/login?${query.toString()}`;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly currentRevision?: number;

  constructor(
    message: string,
    options: { status: number; code: string; currentRevision?: number },
  ) {
    super(message);
    this.name = "ApiError";
    this.status = options.status;
    this.code = options.code;
    if (options.currentRevision !== undefined) {
      this.currentRevision = options.currentRevision;
    }
  }
}

async function request<T>(
  path: string,
  options: RequestInit & { token?: string | undefined } = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");
  if (options.body) headers.set("Content-Type", "application/json");
  if (options.token) headers.set("Authorization", `Bearer ${options.token}`);
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: "same-origin",
    headers,
  });
  const payload = (await response.json().catch(() => ({}))) as {
    error?: string;
    message?: string;
    currentRevision?: number;
  };
  if (!response.ok) {
    throw new ApiError(
      payload.message ?? "The request could not be completed.",
      {
        status: response.status,
        code: payload.error ?? "request_failed",
        ...(payload.currentRevision === undefined
          ? {}
          : { currentRevision: payload.currentRevision }),
      },
    );
  }
  return payload as T;
}

export async function getAuthConfig() {
  return request<{ mode: AuthMode }>("/v1/auth/config");
}

export async function signOutSession() {
  return request<void>("/v1/auth/logout", { method: "POST" });
}

export async function createDevSession(input: {
  email: string;
  displayName: string;
}) {
  return request<{
    token: string;
    session: {
      user: { id: string; email: string; displayName: string };
      expiresInSeconds: number;
    };
  }>("/v1/auth/dev-session", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function getSession(token?: string) {
  return request<{ identity: Identity; workspaces: WorkspaceAccess[] }>(
    "/v1/session",
    { token },
  );
}

export async function listBoards(
  token: string | undefined,
  workspaceId: string,
) {
  return request<{ role: Role; boards: BoardMetadata[] }>(
    `/v1/workspaces/${workspaceId}/boards`,
    { token },
  );
}

export async function createBoard(
  token: string | undefined,
  workspaceId: string,
  title: string,
) {
  return request<{ board: BoardRecord }>(
    `/v1/workspaces/${workspaceId}/boards`,
    { token, method: "POST", body: JSON.stringify({ title }) },
  );
}

export async function getBoard(token: string | undefined, boardId: string) {
  return request<{ board: BoardRecord; role: Role }>(`/v1/boards/${boardId}`, {
    token,
  });
}

export async function saveBoard(
  token: string | undefined,
  boardId: string,
  expectedRevision: number,
  document: BoardDocument,
  reason: string,
) {
  return request<{ board: BoardRecord }>(`/v1/boards/${boardId}`, {
    token,
    method: "PUT",
    body: JSON.stringify({ expectedRevision, document, reason }),
  });
}

export async function listVersions(token: string | undefined, boardId: string) {
  return request<{ versions: BoardVersion[] }>(
    `/v1/boards/${boardId}/versions`,
    { token },
  );
}

export async function restoreVersion(
  token: string | undefined,
  boardId: string,
  versionId: string,
) {
  return request<{ board: BoardRecord }>(
    `/v1/boards/${boardId}/versions/${versionId}/restore`,
    { token, method: "POST" },
  );
}
