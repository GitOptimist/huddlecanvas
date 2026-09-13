import { useCallback, useEffect, useRef, useState } from "react";

import {
  assessLegacyV8,
  type SafeV8Assessment,
  type LegacyImportIssue,
  type BoardDocument,
  type BoardObject,
  type ShapeKind,
  type ShapeObject,
  type StickyObject,
  type StrokeObject,
  type StrokePoint,
  type StrokeStyle,
  type TextObject,
} from "@huddlecanvas/board-schema";
import { applyBoardCommand } from "@huddlecanvas/canvas-core";

import {
  ApiError,
  createBoard,
  createDevSession,
  getAuthConfig,
  getBoard,
  getSession,
  importV8Board,
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
import {
  CanvasPreview,
  type CanvasPoint,
} from "./components/CanvasPreview.tsx";
import { Icon } from "./components/Icon.tsx";

const SESSION_KEY = "huddlecanvas-hosted-session";
const stickyColors = ["#fef3c7", "#dbeafe", "#dcfce7", "#fce7f3"];

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

function ProductBrand({ inverse = false }: { inverse?: boolean }) {
  return (
    <div className={`product-brand${inverse ? " product-brand-inverse" : ""}`}>
      <img
        src={inverse ? "/getitech-logo-dark.png" : "/getitech-logo-light.png"}
        alt="GETITECH"
      />
      <span className="product-brand-divider" aria-hidden="true" />
      <span className="product-brand-name">HuddleCanvas</span>
    </div>
  );
}

type LoginFeedback = {
  kind: "error" | "notice";
  message: string;
};

function loginFeedback(): LoginFeedback | null {
  const params = new URLSearchParams(window.location.search);
  let feedback: LoginFeedback | null = null;
  if (params.get("auth_notice") === "email_confirmation_sent") {
    feedback = {
      kind: "notice",
      message:
        "A confirmation email has been sent. Please verify your email, then sign in again.",
    };
  } else if (params.get("auth_error") === "login_failed") {
    feedback = {
      kind: "error",
      message: "Sign-in could not be completed. Please try again.",
    };
  }
  if (!feedback) return null;
  params.delete("auth_notice");
  params.delete("auth_error");
  const query = params.toString();
  window.history.replaceState(
    {},
    "",
    `${window.location.pathname}${query ? `?${query}` : ""}`,
  );
  return feedback;
}

function SignInScreen({
  authMode,
  initialFeedback,
  onSignedIn,
}: {
  authMode: AuthMode;
  initialFeedback: LoginFeedback | null;
  onSignedIn: (token: string) => void;
}) {
  const [displayName, setDisplayName] = useState("Alex Rivera");
  const [email, setEmail] = useState("alex@example.com");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState(initialFeedback);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setFeedback(null);
    try {
      const result = await createDevSession({ email, displayName });
      localStorage.setItem(SESSION_KEY, result.token);
      onSignedIn(result.token);
    } catch (caught) {
      setFeedback({ kind: "error", message: errorMessage(caught) });
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
        <ProductBrand inverse />
        <div className="story-copy">
          <span className="story-kicker">Early access</span>
          <h1>Turn workshop ideas into action.</h1>
          <p>
            Capture ideas, agree on priorities, assign next steps, and return to
            the same board whenever your team needs it.
          </p>
          <div className="story-proof">
            <span>
              <Icon name="cloud" /> Boards save automatically
            </span>
            <span>
              <Icon name="history" /> Recover earlier versions
            </span>
            <span>
              <Icon name="shield" /> Private team workspace
            </span>
          </div>
        </div>
        <p className="story-boundary">
          Private preview · HuddleCanvas is being tested with a small group of
          teams.
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
            {feedback ? (
              <div
                className={`form-feedback form-feedback-${feedback.kind}`}
                role={feedback.kind === "error" ? "alert" : "status"}
              >
                {feedback.message}
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
            <span className="alpha-badge">Early access</span>
            <h2>Welcome to HuddleCanvas</h2>
            <p>
              Sign in to open your workspace and continue where your team left
              off.
            </p>
            {feedback ? (
              <div
                className={`form-feedback form-feedback-${feedback.kind}`}
                role={feedback.kind === "error" ? "alert" : "status"}
              >
                {feedback.message}
              </div>
            ) : null}
            {authMode === "oidc" ? (
              <button
                className="primary-action"
                type="button"
                onClick={beginHostedSignIn}
              >
                Sign in <Icon name="arrow" />
              </button>
            ) : (
              <div className="form-error" role="alert">
                Staging sign-in has not been configured yet.
              </div>
            )}
            <small>
              Secure sign-in. HuddleCanvas never sees or stores your password.
            </small>
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
  const [authFeedback] = useState(loginFeedback);
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [workspaceAccess, setWorkspaceAccess] =
    useState<WorkspaceAccess | null>(null);
  const [boards, setBoards] = useState<BoardMetadata[]>([]);
  const [activeBoard, setActiveBoard] = useState<BoardRecord | null>(null);
  const [role, setRole] = useState<Role>("viewer");
  const [versions, setVersions] = useState<BoardVersion[]>([]);
  const [selectedObjectIds, setSelectedObjectIds] = useState<string[]>([]);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [error, setError] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saveRetry, setSaveRetry] = useState(0);
  const [importPreview, setImportPreview] = useState<{
    fileName: string;
    payload: unknown;
    assessment: SafeV8Assessment;
    issues: LegacyImportIssue[];
  } | null>(null);
  const [importError, setImportError] = useState("");
  const [importBusy, setImportBusy] = useState(false);
  const importFile = useRef<HTMLInputElement | null>(null);
  const changeSequence = useRef(0);
  const saving = useRef(false);
  const dirtyRef = useRef(false);
  const pendingReason = useRef("Autosave");
  const boardRef = useRef<BoardRecord | null>(null);
  const editHistory = useRef<{
    boardId: string | null;
    undo: BoardDocument[];
    redo: BoardDocument[];
    lastReason: string | null;
    lastAt: number;
  }>({ boardId: null, undo: [], redo: [], lastReason: null, lastAt: 0 });
  const [, setHistoryChange] = useState(0);

  const canEdit = role === "owner" || role === "editor";
  const canRestore = role === "owner";
  const selectedObjectId =
    selectedObjectIds.length === 1 ? selectedObjectIds[0] : null;
  const selectedObject =
    activeBoard && selectedObjectId
      ? (activeBoard.document.objects[selectedObjectId] ?? null)
      : null;
  const canDuplicateSelection = selectedObjectIds.some((id) => {
    const object = activeBoard?.document.objects[id];
    return (
      object?.parentId === null &&
      object.type !== "connector" &&
      object.type !== "group"
    );
  });
  const canDeleteSelection = selectedObjectIds.some((id) => {
    const object = activeBoard?.document.objects[id];
    return object && !object.locked;
  });

  useEffect(() => {
    if (selectedObjectId) setInspectorOpen(true);
  }, [selectedObjectId]);

  function showBoard(board: BoardRecord | null) {
    boardRef.current = board;
    setActiveBoard(board);
  }

  function resetEditHistory(boardId: string | null) {
    editHistory.current = {
      boardId,
      undo: [],
      redo: [],
      lastReason: null,
      lastAt: 0,
    };
    setHistoryChange((count) => count + 1);
  }

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
      if (
        boardRef.current &&
        boardRef.current.id !== boardId &&
        (dirtyRef.current || saving.current)
      ) {
        setError(
          "Wait for this board to finish saving before switching boards.",
        );
        return;
      }
      setError("");
      const [boardResult, versionResult] = await Promise.all([
        getBoard(sessionToken, boardId),
        listVersions(sessionToken, boardId),
      ]);
      boardRef.current = boardResult.board;
      setActiveBoard(boardResult.board);
      setRole(boardResult.role);
      setVersions(versionResult.versions);
      setSelectedObjectIds([]);
      editHistory.current = {
        boardId,
        undo: [],
        redo: [],
        lastReason: null,
        lastAt: 0,
      };
      setHistoryChange((count) => count + 1);
      setDirty(false);
      dirtyRef.current = false;
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
    const current = boardRef.current;
    if (!canEdit || !current) return;
    const document = structuredClone(current.document);
    update(document);
    document.generation = current.document.generation + 1;
    if (editHistory.current.boardId !== current.id) {
      resetEditHistory(current.id);
    }
    const now = Date.now();
    const combineTyping =
      ["Renamed board", "Edited sticky note", "Edited text"].includes(reason) &&
      editHistory.current.lastReason === reason &&
      now - editHistory.current.lastAt < 1000;
    if (!combineTyping) {
      editHistory.current.undo.push(current.document);
      if (editHistory.current.undo.length > 50)
        editHistory.current.undo.shift();
    }
    editHistory.current.lastReason = reason;
    editHistory.current.lastAt = now;
    editHistory.current.redo = [];
    setHistoryChange((count) => count + 1);
    changeSequence.current += 1;
    pendingReason.current = reason;
    showBoard({ ...current, title: document.title, document });
    setDirty(true);
    dirtyRef.current = true;
    setSaveState("unsaved");
  }

  function travelHistory(direction: "undo" | "redo") {
    const current = boardRef.current;
    if (!current || !canEdit || editHistory.current.boardId !== current.id)
      return;
    const source = editHistory.current[direction];
    const previous = source.pop();
    if (!previous) return;
    const destination = direction === "undo" ? "redo" : "undo";
    editHistory.current[destination].push(current.document);
    editHistory.current.lastReason = null;
    setHistoryChange((count) => count + 1);
    const document = {
      ...previous,
      generation: current.document.generation + 1,
    };
    changeSequence.current += 1;
    pendingReason.current =
      direction === "undo" ? "Undid change" : "Redid change";
    showBoard({ ...current, title: document.title, document });
    setDirty(true);
    dirtyRef.current = true;
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
          const current = boardRef.current;
          if (current?.id === result.board.id) {
            showBoard(
              changedWhileSaving
                ? {
                    ...result.board,
                    document: current.document,
                    title: current.document.title,
                  }
                : result.board,
            );
          }
          if (!changedWhileSaving) {
            setDirty(false);
            dirtyRef.current = false;
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
    if (dirtyRef.current || saving.current) {
      setError("Wait for this board to finish saving before creating a board.");
      return;
    }
    setError("");
    try {
      const result = await createBoard(
        token || undefined,
        workspaceAccess.workspace.id,
        "Untitled board",
      );
      await refreshBoardList(workspaceAccess, token || undefined);
      if (dirtyRef.current || saving.current) {
        setImportPreview(null);
        setError(
          "The new board was imported, but this board has unsaved changes. Open the imported board from Your boards after it finishes saving.",
        );
        return;
      }
      await openBoard(result.board.id, token || undefined);
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }

  async function selectV8File(file: File | undefined) {
    if (!file || !canEdit || !workspaceAccess || !identity) return;
    setImportError("");
    setImportPreview(null);
    try {
      if (file.size > 750_000)
        throw new Error(
          "This board is too large for the current import limit (750 KB). Your file is unchanged.",
        );
      const payload: unknown = JSON.parse(await file.text());
      const assessment = assessLegacyV8(payload, { actorId: identity.userId });
      setImportPreview({
        fileName: file.name,
        payload,
        assessment,
        issues: assessment.issues,
      });
    } catch (caught) {
      setImportError(errorMessage(caught));
    }
  }

  async function confirmV8Import() {
    if (
      !importPreview?.assessment.canImport ||
      !workspaceAccess ||
      !canEdit ||
      importBusy
    )
      return;
    if (dirtyRef.current || saving.current) {
      setImportError(
        "Wait for this board to finish saving before importing another board.",
      );
      return;
    }
    setImportBusy(true);
    setImportError("");
    try {
      const result = await importV8Board(
        token || undefined,
        workspaceAccess.workspace.id,
        importPreview.payload,
      );
      await refreshBoardList(workspaceAccess, token || undefined);
      await openBoard(result.board.id, token || undefined);
      setImportPreview(null);
    } catch (caught) {
      setImportError(errorMessage(caught));
      if (caught instanceof ApiError && caught.issues) {
        setImportPreview((previous) =>
          previous ? { ...previous, issues: caught.issues! } : previous,
        );
      }
    } finally {
      setImportBusy(false);
    }
  }

  function addSticky(point?: CanvasPoint) {
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
          x: Math.round((point?.x ?? 210 + (index % 4) * 205) - 90),
          y: Math.round((point?.y ?? 215 + Math.floor(index / 4) * 155) - 62),
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
    setSelectedObjectIds([objectId]);
  }

  function addText(point: CanvasPoint) {
    if (!identity) return;
    const objectId = `text_${crypto.randomUUID()}`;
    updateDocument((document) => {
      const timestamp = new Date().toISOString();
      const object: TextObject = {
        id: objectId,
        type: "text",
        parentId: null,
        orderKey: document.rootOrder.length.toString().padStart(8, "0"),
        transform: {
          x: Math.round(point.x - 110),
          y: Math.round(point.y - 22),
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
        },
        size: { width: 220, height: 44 },
        locked: false,
        hidden: false,
        createdAt: timestamp,
        createdBy: identity.userId,
        updatedAt: timestamp,
        updatedBy: identity.userId,
        text: "Type something",
        altText: "",
        style: {
          color: "#172033",
          fontFamily: "Inter, ui-sans-serif, system-ui",
          fontSize: 22,
          fontWeight: 600,
          textAlign: "left",
        },
      };
      document.objects[objectId] = object;
      document.rootOrder.push(objectId);
    }, "Added text");
    setSelectedObjectIds([objectId]);
  }

  function addShape(point: CanvasPoint, shape: ShapeKind) {
    if (!identity) return;
    const objectId = `shape_${crypto.randomUUID()}`;
    updateDocument(
      (document) => {
        const timestamp = new Date().toISOString();
        const line = shape === "line";
        const object: ShapeObject = {
          id: objectId,
          type: "shape",
          parentId: null,
          orderKey: document.rootOrder.length.toString().padStart(8, "0"),
          transform: {
            x: Math.round(point.x - 70),
            y: Math.round(point.y - (line ? 35 : 55)),
            rotation: 0,
            scaleX: 1,
            scaleY: 1,
          },
          size: { width: 140, height: line ? 70 : 110 },
          locked: false,
          hidden: false,
          createdAt: timestamp,
          createdBy: identity.userId,
          updatedAt: timestamp,
          updatedBy: identity.userId,
          shape,
          style: {
            stroke: "#6256d9",
            strokeWidth: 2.5,
            fill: line ? null : "#f5f3ff",
            opacity: 1,
          },
        };
        document.objects[objectId] = object;
        document.rootOrder.push(objectId);
      },
      `Added ${shape.replace("-", " ")}`,
    );
    setSelectedObjectIds([objectId]);
  }

  function addStroke(points: StrokePoint[], style: StrokeStyle) {
    if (!identity || points.length < 2) return;
    const objectId = `stroke_${crypto.randomUUID()}`;
    updateDocument(
      (document) => {
        const timestamp = new Date().toISOString();
        const minX = Math.min(...points.map((point) => point.x));
        const minY = Math.min(...points.map((point) => point.y));
        const maxX = Math.max(...points.map((point) => point.x));
        const maxY = Math.max(...points.map((point) => point.y));
        const object: StrokeObject = {
          id: objectId,
          type: "stroke",
          parentId: null,
          orderKey: document.rootOrder.length.toString().padStart(8, "0"),
          transform: {
            x: minX,
            y: minY,
            rotation: 0,
            scaleX: 1,
            scaleY: 1,
          },
          size: {
            width: Math.max(1, maxX - minX),
            height: Math.max(1, maxY - minY),
          },
          locked: false,
          hidden: false,
          createdAt: timestamp,
          createdBy: identity.userId,
          updatedAt: timestamp,
          updatedBy: identity.userId,
          points: points.map((point) => ({
            ...point,
            x: point.x - minX,
            y: point.y - minY,
          })),
          style,
        };
        document.objects[objectId] = object;
        document.rootOrder.push(objectId);
      },
      style.opacity < 1 ? "Added highlight" : "Added pen stroke",
    );
  }

  function eraseStrokes(objectIds: string[]) {
    const ids = objectIds.filter((id) => {
      const object = boardRef.current?.document.objects[id];
      return object?.type === "stroke" && !object.locked;
    });
    if (!ids.length || !identity) return;
    updateDocument((document) => {
      Object.assign(
        document,
        applyBoardCommand(
          document,
          {
            type: "object.remove",
            objectIds: ids,
          },
          { actorId: identity.userId, now: new Date().toISOString() },
        ),
      );
    }, "Erased ink");
    if (selectedObjectIds.some((id) => ids.includes(id)))
      setSelectedObjectIds([]);
  }

  function moveObjects(objectIds: string[], dx: number, dy: number) {
    if (!identity) return;
    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;
    updateDocument(
      (document) => {
        Object.assign(
          document,
          applyBoardCommand(
            document,
            {
              type: "object.move",
              objectIds,
              deltaX: Math.round(dx),
              deltaY: Math.round(dy),
            },
            { actorId: identity.userId, now: new Date().toISOString() },
          ),
        );
      },
      objectIds.length > 1 ? "Moved objects" : "Moved object",
    );
  }

  function deleteSelection() {
    if (!selectedObjectIds.length) return;
    const deletable = selectedObjectIds.filter((id) => {
      const object = boardRef.current?.document.objects[id];
      return object && !object.locked;
    });
    if (!deletable.length || !identity) return;
    updateDocument(
      (document) => {
        Object.assign(
          document,
          applyBoardCommand(
            document,
            {
              type: "object.remove",
              objectIds: deletable,
            },
            { actorId: identity.userId, now: new Date().toISOString() },
          ),
        );
      },
      deletable.length > 1 ? "Deleted objects" : "Deleted object",
    );
    setSelectedObjectIds([]);
  }

  function duplicateSelection() {
    if (!identity) return;
    const selected = selectedObjectIds
      .map((id) => boardRef.current?.document.objects[id])
      .filter((object): object is BoardObject =>
        Boolean(
          object &&
          object.parentId === null &&
          object.type !== "connector" &&
          object.type !== "group",
        ),
      );
    if (!selected.length) return;
    const ids: string[] = [];
    updateDocument(
      (document) => {
        const timestamp = new Date().toISOString();
        for (const original of selected) {
          const id = `${original.type}_${crypto.randomUUID()}`;
          const object: BoardObject = structuredClone(original);
          object.id = id;
          object.orderKey = document.rootOrder.length
            .toString()
            .padStart(8, "0");
          object.transform.x += 24;
          object.transform.y += 24;
          object.createdAt = timestamp;
          object.updatedAt = timestamp;
          object.createdBy = identity.userId;
          object.updatedBy = identity.userId;
          document.objects[id] = object;
          document.rootOrder.push(id);
          ids.push(id);
        }
      },
      selected.length > 1 ? "Duplicated objects" : "Duplicated object",
    );
    setSelectedObjectIds(ids);
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

  function updateSelectedText(text: string) {
    if (!selectedObjectId || !identity) return;
    updateDocument((document) => {
      const object = document.objects[selectedObjectId];
      if (!object || object.type !== "text") return;
      object.text = text;
      object.updatedAt = new Date().toISOString();
      object.updatedBy = identity.userId;
    }, "Edited text");
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
      showBoard(result.board);
      setSelectedObjectIds([]);
      resetEditHistory(result.board.id);
      setDirty(false);
      dirtyRef.current = false;
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
    showBoard(null);
    dirtyRef.current = false;
    resetEditHistory(null);
  }

  useEffect(() => {
    function keyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true']"))
        return;
      if (!canEdit || !boardRef.current) return;
      const modifier = event.ctrlKey || event.metaKey;
      if (modifier && event.key.toLowerCase() === "z") {
        event.preventDefault();
        travelHistory(event.shiftKey ? "redo" : "undo");
      } else if (modifier && event.key.toLowerCase() === "y") {
        event.preventDefault();
        travelHistory("redo");
      } else if (
        modifier &&
        event.key.toLowerCase() === "d" &&
        selectedObjectIds.length
      ) {
        event.preventDefault();
        duplicateSelection();
      } else if (
        !modifier &&
        (event.key === "Delete" || event.key === "Backspace") &&
        selectedObjectIds.length
      ) {
        event.preventDefault();
        deleteSelection();
      }
    }
    window.addEventListener("keydown", keyDown);
    return () => window.removeEventListener("keydown", keyDown);
  });

  if (!loading && !identity) {
    return (
      <SignInScreen
        authMode={authMode}
        initialFeedback={
          authFeedback ?? (error ? { kind: "error", message: error } : null)
        }
        onSignedIn={setToken}
      />
    );
  }

  if (loading || !identity || !workspaceAccess) {
    return (
      <main className="loading-shell" aria-live="polite">
        <span className="loading-mark" />
        <strong>Opening your workspace…</strong>
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
        <ProductBrand />
        <div className="workspace-switcher">
          <span className="workspace-avatar">
            {workspaceAccess.workspace.name[0]?.toUpperCase()}
          </span>
          <span>
            <small>Workspace</small>
            {workspaceAccess.workspace.name}
          </span>
        </div>
        <nav aria-label="Workspace">
          <button className="nav-item active" aria-current="page">
            <Icon name="board" /> Boards
            <span className="nav-count">{boards.length}</span>
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
        {canEdit ? (
          <div className="v8-import-entry">
            <input
              ref={importFile}
              type="file"
              accept=".flowboard,.json,application/json"
              aria-label="Select a v8 board export"
              hidden
              onChange={(event) => {
                void selectV8File(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
            <button type="button" onClick={() => importFile.current?.click()}>
              Import v8 board
            </button>
          </div>
        ) : null}
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
          <div
            className="edit-actions"
            role="group"
            aria-label="Board edit history"
          >
            <button
              type="button"
              disabled={!canEdit || !editHistory.current.undo.length}
              onClick={() => travelHistory("undo")}
              title="Undo (Ctrl/⌘ Z)"
            >
              ↶ Undo
            </button>
            <button
              type="button"
              disabled={!canEdit || !editHistory.current.redo.length}
              onClick={() => travelHistory("redo")}
              title="Redo (Ctrl/⌘ Shift Z)"
            >
              ↷ Redo
            </button>
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
            <button
              className={
                inspectorOpen ? "activity-toggle active" : "activity-toggle"
              }
              type="button"
              aria-pressed={inspectorOpen}
              onClick={() => setInspectorOpen((open) => !open)}
            >
              <Icon name="clock" size={15} /> History
            </button>
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

        {importError && !importPreview ? (
          <div className="workspace-alert" role="alert">
            {importError}
            <button type="button" onClick={() => setImportError("")}>
              Dismiss
            </button>
          </div>
        ) : null}

        {importPreview ? (
          <div
            className="v8-import-overlay"
            role="presentation"
            onClick={() => !importBusy && setImportPreview(null)}
          >
            <section
              className="v8-import-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="v8-import-title"
              onClick={(event) => event.stopPropagation()}
            >
              <h2 id="v8-import-title">Import v8 board</h2>
              <p>
                Source: {importPreview.fileName}. This creates a new hosted
                board; your v8 file and existing boards stay unchanged.
              </p>
              <p>
                <strong>{importPreview.assessment.document.title}</strong> ·{" "}
                {Object.keys(importPreview.assessment.document.objects).length}{" "}
                objects
              </p>
              {importPreview.issues.length ? (
                <div className="v8-import-issues" role="alert">
                  <strong>
                    Import blocked: these details would not carry over.
                  </strong>
                  <ul>
                    {importPreview.issues.map((issue, index) => (
                      <li key={`${issue.path}-${index}`}>
                        <code>{issue.path}</code>: {issue.message}
                      </li>
                    ))}
                  </ul>
                  <p>
                    Keep editing the v8 board for now. No hosted board was
                    created.
                  </p>
                </div>
              ) : (
                <p className="v8-import-safe">
                  No unsupported content detected. Review the hosted copy after
                  import before relying on it.
                </p>
              )}
              {importError ? (
                <p role="alert" className="v8-import-error">
                  {importError}
                </p>
              ) : null}
              <div className="v8-import-actions">
                <button
                  type="button"
                  disabled={importBusy}
                  onClick={() => setImportPreview(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="primary-action"
                  disabled={importBusy || importPreview.issues.length > 0}
                  onClick={() => void confirmV8Import()}
                >
                  {importBusy ? "Importing…" : "Import as new board"}
                </button>
              </div>
            </section>
          </div>
        ) : null}

        <div
          className={
            inspectorOpen ? "content-grid" : "content-grid inspector-closed"
          }
        >
          <section className="canvas-panel" id="board">
            {activeBoard ? (
              <CanvasPreview
                key={activeBoard.id}
                board={activeBoard.document}
                canEdit={canEdit}
                selectedObjectIds={selectedObjectIds}
                onSelectionChange={setSelectedObjectIds}
                {...(canEdit
                  ? {
                      onObjectsMove: moveObjects,
                      onAddSticky: addSticky,
                      onAddText: addText,
                      onAddShape: addShape,
                      onAddStroke: addStroke,
                      onEraseStrokes: eraseStrokes,
                    }
                  : {})}
              />
            ) : (
              <div className="empty-board-state">
                <Icon name="board" size={28} />
                <strong>Create your first board</strong>
              </div>
            )}
            {selectedObjectIds.length > 0 && canEdit ? (
              <div
                className="selection-actions"
                role="toolbar"
                aria-label="Selection actions"
              >
                <span>{selectedObjectIds.length} selected</span>
                <button
                  type="button"
                  disabled={!canDuplicateSelection}
                  onClick={duplicateSelection}
                  title="Duplicate (Ctrl/⌘ D)"
                >
                  Duplicate
                </button>
                <button
                  type="button"
                  disabled={!canDeleteSelection}
                  onClick={deleteSelection}
                  title="Delete (Delete)"
                >
                  Delete
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedObjectIds([])}
                  aria-label="Clear selection"
                >
                  ×
                </button>
              </div>
            ) : null}
          </section>

          <aside
            className="inspector"
            aria-label="Selection and board history"
            hidden={!inspectorOpen}
          >
            <div className="inspector-heading">
              <div className="inspector-icon">
                <Icon name={selectedObject ? "cursor" : "clock"} />
              </div>
              <div>
                <span>{selectedObject ? "Selected" : "Board"}</span>
                <h2>{selectedObject ? "Edit object" : "History"}</h2>
              </div>
              <button
                className="inspector-close"
                type="button"
                aria-label="Close inspector"
                onClick={() => setInspectorOpen(false)}
              >
                ×
              </button>
            </div>

            {selectedObjectIds.length > 1 ? (
              <section className="selection-summary">
                <strong>{selectedObjectIds.length} objects selected</strong>
                <small>Drag them together or use Duplicate and Delete.</small>
              </section>
            ) : selectedObject?.type === "sticky" ? (
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
            ) : selectedObject?.type === "text" ? (
              <section className="object-editor">
                <label>
                  Text
                  <textarea
                    value={selectedObject.text}
                    disabled={!canEdit}
                    onChange={(event) => updateSelectedText(event.target.value)}
                  />
                </label>
                <p>Drag the text on the board to reposition it.</p>
              </section>
            ) : selectedObject ? (
              <section className="selection-summary">
                <span>{selectedObject.type}</span>
                <strong>
                  {selectedObject.locked
                    ? "This object is locked"
                    : "Drag to reposition"}
                </strong>
                <small>
                  {Math.round(selectedObject.size.width)} ×{" "}
                  {Math.round(selectedObject.size.height)} px
                </small>
              </section>
            ) : null}

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
          </aside>
        </div>
      </main>
    </div>
  );
}
