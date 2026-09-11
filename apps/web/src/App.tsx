import { useCallback, useEffect, useRef, useState } from "react";

import type {
  BoardDocument,
  BoardObject,
  StickyObject,
} from "@huddlecanvas/board-schema";

import {
  ApiError,
  createBoard,
  createDevSession,
  getAuthConfig,
  getBoard,
  getSession,
  hostedLoginUrl,
  listBoards,
  listVersions,
  restoreVersion,
  saveBoard,
  signOutSession,
  type AuthMode,
  type BoardMetadata,
  type BoardRecord,
  type BoardVersion,
  type Identity,
  type Role,
  type WorkspaceAccess,
} from "./api.ts";
import { CanvasPreview } from "./components/CanvasPreview.tsx";
import { Icon, type IconName } from "./components/Icon.tsx";

const SESSION_KEY = "huddlecanvas-hosted-session";
const stickyColors = ["#fef3c7", "#dbeafe", "#dcfce7", "#fce7f3"];

const tools: Array<{ name: IconName; label: string; enabled: boolean }> = [
  { name: "cursor", label: "Select and move", enabled: true },
  { name: "note", label: "Add sticky note", enabled: true },
  { name: "text", label: "Text — coming next", enabled: false },
  { name: "connector", label: "Connector — coming next", enabled: false },
  { name: "frame", label: "Frame — coming next", enabled: false },
];

type SaveState = "saved" | "saving" | "unsaved" | "conflict" | "error";

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function dateLabel(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "The request could not be completed.";
}

function loginError(): string {
  const params = new URLSearchParams(window.location.search);
  if (params.get("auth_error") !== "login_failed") return "";
  params.delete("auth_error");
  const query = params.toString();
  window.history.replaceState(
    {},
    "",
    `${window.location.pathname}${query ? `?${query}` : ""}`,
  );
  return "Sign-in could not be completed. Please try again.";
}

function SignInScreen({
  authMode,
  initialError,
  onSignedIn,
}: {
  authMode: AuthMode;
  initialError: string;
  onSignedIn: (token: string) => void;
}) {
  const [displayName, setDisplayName] = useState("Alex Rivera");
  const [email, setEmail] = useState("alex@example.com");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(initialError);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await createDevSession({ email, displayName });
      localStorage.setItem(SESSION_KEY, result.token);
      onSignedIn(result.token);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  function beginHostedSignIn() {
    window.location.assign(hostedLoginUrl("/"));
  }

  return (
    <main className="sign-in-shell">
      <section className="sign-in-story" aria-label="HuddleCanvas introduction">
        <div className="brand brand-on-dark">
          <span className="brand-mark" aria-hidden="true">
            <span />
          </span>
          <span>HuddleCanvas</span>
        </div>
        <div className="story-copy">
          <span className="story-kicker">Hosted Alpha · M3.4</span>
          <h1>Your workshop should still be useful tomorrow.</h1>
          <p>
            Open a durable workspace, make a decision visible, and return to the
            same board from a fresh session—with recovery built in.
          </p>
          <div className="story-proof">
            <span>
              <Icon name="cloud" /> Durable board repository
            </span>
            <span>
              <Icon name="history" /> Automatic version recovery
            </span>
            <span>
              <Icon name="shield" /> Server-enforced workspace roles
            </span>
          </div>
        </div>
        <p className="story-boundary">
          Secure hosted sign-in and PostgreSQL persistence are enabled for the
          staging durability gate. Realtime presence follows after recovery is
          proven across browsers.
        </p>
      </section>

      <section className="sign-in-panel">
        {authMode === "development" ? (
          <form className="sign-in-card" onSubmit={submit}>
            <span className="alpha-badge">Development access</span>
            <h2>Enter your hosted workspace</h2>
            <p>
              This local-only form issues a time-limited development session.
            </p>
            <label>
              Display name
              <input
                name="displayName"
                autoComplete="name"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                required
              />
            </label>
            <label>
              Work email
              <input
                name="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </label>
            {error ? (
              <div className="form-error" role="alert">
                {error}
              </div>
            ) : null}
            <button className="primary-action" disabled={busy}>
              {busy ? "Creating secure session…" : "Continue to workspace"}
              <Icon name="arrow" />
            </button>
            <small>
              Development access is disabled in staging and production.
            </small>
          </form>
        ) : (
          <div className="sign-in-card">
            <span className="alpha-badge">Invited alpha</span>
            <h2>Sign in to HuddleCanvas</h2>
            <p>
              Use your invited account to open the same workspace and boards on
              any supported browser.
            </p>
            {error ? (
              <div className="form-error" role="alert">
                {error}
              </div>
            ) : null}
            {authMode === "oidc" ? (
              <button
                className="primary-action"
                type="button"
                onClick={beginHostedSignIn}
              >
                Continue securely <Icon name="arrow" />
              </button>
            ) : (
              <div className="form-error" role="alert">
                Staging sign-in has not been configured yet.
              </div>
            )}
            <small>Your password is handled by the identity provider.</small>
          </div>
        )}
      </section>
    </main>
  );
}

export default function App() {
  const [token, setToken] = useState(
    () => localStorage.getItem(SESSION_KEY) ?? "",
  );
  const [authMode, setAuthMode] = useState<AuthMode>("unavailable");
  const [authError] = useState(loginError);
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [workspaceAccess, setWorkspaceAccess] =
    useState<WorkspaceAccess | null>(null);
  const [boards, setBoards] = useState<BoardMetadata[]>([]);
  const [activeBoard, setActiveBoard] = useState<BoardRecord | null>(null);
  const [role, setRole] = useState<Role>("viewer");
  const [versions, setVersions] = useState<BoardVersion[]>([]);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [error, setError] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saveRetry, setSaveRetry] = useState(0);
  const changeSequence = useRef(0);
  const saving = useRef(false);
  const pendingReason = useRef("Autosave");

  const canEdit = role === "owner" || role === "editor";
  const canRestore = role === "owner";
  const selectedObject =
    activeBoard && selectedObjectId
      ? (activeBoard.document.objects[selectedObjectId] ?? null)
      : null;

  const refreshBoardList = useCallback(
    async (access: WorkspaceAccess, sessionToken?: string) => {
      const result = await listBoards(sessionToken, access.workspace.id);
      setRole(result.role);
      setBoards(result.boards);
      return result.boards;
    },
    [],
  );

  const openBoard = useCallback(
    async (boardId: string, sessionToken = token || undefined) => {
      setError("");
      const [boardResult, versionResult] = await Promise.all([
        getBoard(sessionToken, boardId),
        listVersions(sessionToken, boardId),
      ]);
      setActiveBoard(boardResult.board);
      setRole(boardResult.role);
      setVersions(versionResult.versions);
      setSelectedObjectId(null);
      setDirty(false);
      setSaveState("saved");
    },
    [token],
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const config = await getAuthConfig();
        if (cancelled) return;
        setAuthMode(config.mode);
        const sessionToken = token || undefined;
        const session = await getSession(sessionToken);
        if (cancelled) return;
        const access = session.workspaces[0];
        if (!access)
          throw new Error("No workspace is available for this account.");
        setIdentity(session.identity);
        setWorkspaceAccess(access);
        const availableBoards = await refreshBoardList(access, sessionToken);
        if (cancelled) return;
        const first = availableBoards[0];
        if (first) await openBoard(first.id, sessionToken);
      } catch (caught) {
        if (cancelled) return;
        if (caught instanceof ApiError && caught.status === 401) {
          localStorage.removeItem(SESSION_KEY);
          setToken("");
          setIdentity(null);
        } else {
          setError(errorMessage(caught));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [openBoard, refreshBoardList, token]);

  function updateDocument(
    update: (document: BoardDocument) => void,
    reason: string,
  ) {
    if (!canEdit) return;
    changeSequence.current += 1;
    pendingReason.current = reason;
    setActiveBoard((current) => {
      if (!current) return current;
      const document = structuredClone(current.document);
      update(document);
      document.generation = current.document.generation + 1;
      return { ...current, title: document.title, document };
    });
    setDirty(true);
    setSaveState("unsaved");
  }

  useEffect(() => {
    if (!dirty || !activeBoard || !canEdit || saving.current) return;
    const timer = window.setTimeout(() => {
      const sequence = changeSequence.current;
      const snapshot = structuredClone(activeBoard.document);
      const expectedRevision = activeBoard.revision;
      const boardId = activeBoard.id;
      saving.current = true;
      setSaveState("saving");
      void saveBoard(
        token || undefined,
        boardId,
        expectedRevision,
        snapshot,
        pendingReason.current,
      )
        .then(async (result) => {
          const changedWhileSaving = changeSequence.current !== sequence;
          setActiveBoard((current) => {
            if (!current || current.id !== result.board.id) return current;
            return changedWhileSaving
              ? {
                  ...result.board,
                  document: current.document,
                  title: current.document.title,
                }
              : result.board;
          });
          if (!changedWhileSaving) {
            setDirty(false);
            setSaveState("saved");
          } else {
            setSaveState("unsaved");
          }
          if (workspaceAccess) {
            await refreshBoardList(workspaceAccess, token);
          }
          const versionResult = await listVersions(token, boardId);
          setVersions(versionResult.versions);
        })
        .catch((caught) => {
          setSaveState(
            caught instanceof ApiError && caught.code === "revision_conflict"
              ? "conflict"
              : "error",
          );
          setError(errorMessage(caught));
        })
        .finally(() => {
          saving.current = false;
          if (changeSequence.current !== sequence) {
            setSaveRetry((value) => value + 1);
          }
        });
    }, 700);
    return () => window.clearTimeout(timer);
  }, [
    activeBoard,
    canEdit,
    dirty,
    refreshBoardList,
    saveRetry,
    token,
    workspaceAccess,
  ]);

  useEffect(() => {
    if (!dirty) return;
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [dirty]);

  async function addBoard() {
    if (!workspaceAccess || !canEdit) return;
    setError("");
    try {
      const result = await createBoard(
        token || undefined,
        workspaceAccess.workspace.id,
        "Untitled board",
      );
      await refreshBoardList(workspaceAccess, token || undefined);
      await openBoard(result.board.id, token || undefined);
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }

  function addSticky() {
    if (!identity) return;
    const objectId = `sticky_${crypto.randomUUID()}`;
    updateDocument((document) => {
      const index = Object.values(document.objects).filter(
        (object) => object.type === "sticky",
      ).length;
      const timestamp = new Date().toISOString();
      const sticky: StickyObject = {
        id: objectId,
        type: "sticky",
        parentId: null,
        orderKey: document.rootOrder.length.toString().padStart(8, "0"),
        transform: {
          x: 120 + (index % 4) * 205,
          y: 150 + Math.floor(index / 4) * 155,
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
        },
        size: { width: 180, height: 125 },
        locked: false,
        hidden: false,
        createdAt: timestamp,
        createdBy: identity.userId,
        updatedAt: timestamp,
        updatedBy: identity.userId,
        text: "Add your idea",
        color: stickyColors[index % stickyColors.length] ?? stickyColors[0]!,
      };
      document.objects[objectId] = sticky;
      document.rootOrder.push(objectId);
    }, "Added sticky note");
    setSelectedObjectId(objectId);
  }

  function moveObject(objectId: string, x: number, y: number) {
    if (!identity) return;
    updateDocument((document) => {
      const object = document.objects[objectId];
      if (!object || object.locked) return;
      object.transform.x = Math.round(x);
      object.transform.y = Math.round(y);
      object.updatedAt = new Date().toISOString();
      object.updatedBy = identity.userId;
    }, "Moved object");
  }

  function updateSelectedSticky(
    update: Partial<Pick<StickyObject, "text" | "color">>,
  ) {
    if (!selectedObjectId || !identity) return;
    updateDocument((document) => {
      const object = document.objects[selectedObjectId];
      if (!object || object.type !== "sticky") return;
      Object.assign(object, update, {
        updatedAt: new Date().toISOString(),
        updatedBy: identity.userId,
      });
    }, "Edited sticky note");
  }

  async function recover(version: BoardVersion) {
    if (!activeBoard || !canRestore) return;
    setError("");
    try {
      const result = await restoreVersion(
        token || undefined,
        activeBoard.id,
        version.id,
      );
      setActiveBoard(result.board);
      setSelectedObjectId(null);
      setDirty(false);
      setSaveState("saved");
      const versionResult = await listVersions(
        token || undefined,
        activeBoard.id,
      );
      setVersions(versionResult.versions);
      if (workspaceAccess)
        await refreshBoardList(workspaceAccess, token || undefined);
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }

  async function reloadServerCopy() {
    if (!activeBoard) return;
    try {
      await openBoard(activeBoard.id);
      setError("");
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }

  async function signOut() {
    if (
      dirty &&
      !window.confirm("This board still has unsaved changes. Sign out anyway?")
    ) {
      return;
    }
    try {
      await signOutSession();
    } catch {
      // Clear local state even if the remote session has already expired.
    }
    localStorage.removeItem(SESSION_KEY);
    setToken("");
    setIdentity(null);
    setWorkspaceAccess(null);
    setBoards([]);
    setActiveBoard(null);
  }

  if (!loading && !identity) {
    return (
      <SignInScreen
        authMode={authMode}
        initialError={authError || error}
        onSignedIn={setToken}
      />
    );
  }

  if (loading || !identity || !workspaceAccess) {
    return (
      <main className="loading-shell" aria-live="polite">
        <span className="loading-mark" />
        <strong>Opening your durable workspace…</strong>
      </main>
    );
  }

  const saveLabel = {
    saved: "Saved",
    saving: "Saving…",
    unsaved: "Unsaved changes",
    conflict: "Newer server copy",
    error: "Save failed",
  }[saveState];

  return (
    <div className="app-shell hosted-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            <span />
          </span>
          <span>HuddleCanvas</span>
        </div>
        <button className="workspace-switcher" type="button">
          <span className="workspace-avatar">
            {workspaceAccess.workspace.name[0]?.toUpperCase()}
          </span>
          <span>
            <small>Workspace</small>
            {workspaceAccess.workspace.name}
          </span>
          <Icon name="chevron-down" size={15} />
        </button>
        <nav aria-label="Workspace">
          <button className="nav-item active" aria-current="page">
            <Icon name="board" /> Boards
            <span className="nav-count">{boards.length}</span>
          </button>
          <button className="nav-item" disabled>
            <Icon name="clock" /> Recent
          </button>
          <button className="nav-item" disabled>
            <Icon name="grid" /> Templates
          </button>
        </nav>
        <div className="sidebar-section">
          <span>Your boards</span>
          {canEdit ? (
            <button
              className="icon-button"
              onClick={() => void addBoard()}
              aria-label="Create board"
            >
              <Icon name="plus" size={16} />
            </button>
          ) : null}
        </div>
        <div className="board-list">
          {boards.map((board, index) => (
            <button
              key={board.id}
              className={
                board.id === activeBoard?.id
                  ? "board-row selected"
                  : "board-row"
              }
              onClick={() => void openBoard(board.id)}
            >
              <span
                className={`board-color ${["teal", "violet", "amber"][index % 3] ?? "teal"}`}
              />
              <span>{board.title}</span>
              <small>r{board.revision}</small>
            </button>
          ))}
        </div>
        <div className="sidebar-footer">
          <span className="avatar">{initials(identity.displayName)}</span>
          <div>
            <strong>{identity.displayName}</strong>
            <small>{role} · signed session</small>
          </div>
          <button
            className="icon-button"
            onClick={signOut}
            aria-label="Sign out"
          >
            <Icon name="logout" size={16} />
          </button>
        </div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div className="title-block hosted-title">
            <div>
              <span>Boards</span>
              <Icon name="chevron" size={14} />
              <strong>{activeBoard?.title ?? "No board selected"}</strong>
            </div>
            <input
              aria-label="Board title"
              value={activeBoard?.document.title ?? ""}
              disabled={!activeBoard || !canEdit}
              onChange={(event) => {
                const title = event.target.value;
                updateDocument((document) => {
                  document.title = title;
                }, "Renamed board");
              }}
            />
          </div>
          <div className="topbar-actions">
            <span className={`save-state save-${saveState}`} role="status">
              <Icon
                name={saveState === "saved" ? "cloud-check" : "cloud"}
                size={16}
              />
              {saveLabel}
            </span>
            <span className="role-badge">{role}</span>
            <span className="revision-label">
              Revision {activeBoard?.revision ?? "—"}
            </span>
          </div>
        </header>

        {error ? (
          <div className="workspace-alert" role="alert">
            <span>{error}</span>
            {saveState === "conflict" ? (
              <button onClick={() => void reloadServerCopy()}>
                <Icon name="refresh" size={15} /> Load server copy
              </button>
            ) : saveState === "error" ? (
              <button
                onClick={() => {
                  setError("");
                  setSaveState("unsaved");
                  setSaveRetry((value) => value + 1);
                }}
              >
                <Icon name="refresh" size={15} /> Retry save
              </button>
            ) : (
              <button onClick={() => setError("")} aria-label="Dismiss error">
                ×
              </button>
            )}
          </div>
        ) : null}

        <div className="content-grid">
          <section className="canvas-panel" id="board">
            <div
              className="canvas-toolbar"
              role="toolbar"
              aria-label="Canvas tools"
            >
              {tools.map((tool, index) => (
                <button
                  key={tool.label}
                  className={index === 0 ? "tool-button active" : "tool-button"}
                  disabled={!tool.enabled || !activeBoard || !canEdit}
                  title={tool.label}
                  onClick={tool.name === "note" ? addSticky : undefined}
                >
                  <Icon name={tool.name} />
                  <span>{tool.label}</span>
                </button>
              ))}
              <span className="toolbar-divider" />
              <span className="durable-indicator">
                <Icon name="cloud-check" size={15} /> Durable alpha
              </span>
            </div>
            {activeBoard ? (
              <CanvasPreview
                board={activeBoard.document}
                selectedObjectId={selectedObjectId}
                onSelect={setSelectedObjectId}
                {...(canEdit ? { onObjectMove: moveObject } : {})}
              />
            ) : (
              <div className="empty-board-state">
                <Icon name="board" size={28} />
                <strong>Create your first board</strong>
              </div>
            )}
            <div className="zoom-control">
              <button disabled aria-label="Zoom out">
                −
              </button>
              <span>100%</span>
              <button disabled aria-label="Zoom in">
                +
              </button>
            </div>
          </section>

          <aside className="inspector" aria-label="Board details and recovery">
            <div className="inspector-heading">
              <div className="inspector-icon">
                <Icon name="cloud-check" />
              </div>
              <div>
                <span>M3.2 durability gate</span>
                <h2>
                  {selectedObject ? "Object inspector" : "Board activity"}
                </h2>
              </div>
            </div>

            {selectedObject?.type === "sticky" ? (
              <section className="object-editor">
                <label>
                  Note
                  <textarea
                    value={selectedObject.text}
                    disabled={!canEdit}
                    onChange={(event) =>
                      updateSelectedSticky({ text: event.target.value })
                    }
                  />
                </label>
                <div>
                  <span>Color</span>
                  <div className="color-options">
                    {stickyColors.map((color) => (
                      <button
                        key={color}
                        className={
                          selectedObject.color === color ? "selected" : ""
                        }
                        style={{ background: color }}
                        onClick={() => updateSelectedSticky({ color })}
                        aria-label={`Set note color ${color}`}
                      />
                    ))}
                  </div>
                </div>
                <p>Drag the note on the board to reposition it.</p>
              </section>
            ) : (
              <section className="durability-card">
                <div>
                  <Icon name="database" />
                  <strong>Durable repository</strong>
                </div>
                <p>
                  Board documents are validated, saved atomically, and guarded
                  by optimistic revisions before each write.
                </p>
                <span className="status-chip">Operational</span>
              </section>
            )}

            <section className="inspector-section version-section">
              <div className="section-title">
                <h3>Version history</h3>
                <span>{versions.length} saved</span>
              </div>
              <div className="version-list">
                {versions.slice(0, 8).map((version, index) => (
                  <article
                    key={version.id}
                    className={
                      index === 0 ? "version-row current" : "version-row"
                    }
                  >
                    <span className="version-dot" />
                    <div>
                      <strong>Revision {version.revision}</strong>
                      <span>{version.reason}</span>
                      <small>{dateLabel(version.createdAt)}</small>
                    </div>
                    {canRestore && index !== 0 ? (
                      <button onClick={() => void recover(version)}>
                        Restore
                      </button>
                    ) : null}
                  </article>
                ))}
              </div>
            </section>

            <div className="boundary-note hosted-boundary">
              <Icon name="shield" size={16} />
              <span>
                <strong>Honest boundary</strong>
                Signed local-alpha identity and single-node durable storage are
                active. Realtime transport is not yet enabled.
              </span>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
