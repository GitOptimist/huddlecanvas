import { useEffect, useRef, useState } from "react";
import {
  ApiError,
  getClassicWorkspace,
  saveClassicWorkspace,
  type ClassicSnapshot,
  type Identity,
} from "./api";
import "./classic-workspace.css";

export function ClassicWorkspace({
  token,
  identity,
  onSignOut,
}: {
  token: string | undefined;
  identity: Identity;
  onSignOut: () => Promise<void>;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const snapshot = useRef<ClassicSnapshot | null>(null);
  const pending = useRef<Record<string, unknown> | null>(null);
  const latest = useRef<Record<string, unknown> | null>(null);
  const running = useRef<Promise<void> | null>(null);
  const blocked = useRef(false);
  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState("Loading your boards…");
  const [error, setError] = useState("");
  const [leaving, setLeaving] = useState(false);

  async function flush(): Promise<void> {
    if (running.current) {
      await running.current;
      return flush();
    }
    if (blocked.current)
      throw new Error(
        "Download your backup before reloading the newer cloud copy.",
      );
    if (!pending.current || !snapshot.current) return;
    const task = (async () => {
      while (pending.current && snapshot.current) {
        const workspace = pending.current;
        pending.current = null;
        setStatus("Saving…");
        try {
          snapshot.current = await saveClassicWorkspace(
            token,
            snapshot.current.revision,
            workspace,
          );
        } catch (caught) {
          pending.current ??= workspace;
          blocked.current = caught instanceof ApiError && caught.status === 409;
          const message = blocked.current
            ? "Another tab saved a newer version. Download a backup of your changes, then reload the cloud copy."
            : caught instanceof Error
              ? caught.message
              : "Cloud save failed. Your changes are still open here.";
          setError(message);
          setStatus("Changes not saved");
          throw caught;
        }
      }
      setError("");
      setStatus("Saved to your account");
    })();
    running.current = task;
    try {
      await task;
    } finally {
      running.current = null;
    }
  }

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    function receive(event: MessageEvent) {
      if (event.source !== frame.current?.contentWindow) return;
      if (event.data?.type === "huddle:ready" && snapshot.current) {
        frame.current?.contentWindow?.postMessage(
          { type: "huddle:init", workspace: snapshot.current.workspace },
          "*",
        );
      } else if (
        event.data?.type === "huddle:save" &&
        snapshot.current &&
        event.data.workspace?.version === 8
      ) {
        latest.current = pending.current = event.data.workspace;
        setStatus("Unsaved changes");
        clearTimeout(timer);
        timer = setTimeout(() => {
          void flush().catch(() => {});
        }, 400);
      }
    }
    function beforeUnload(event: BeforeUnloadEvent) {
      if (pending.current || running.current) {
        event.preventDefault();
        event.returnValue = "";
      }
    }
    window.addEventListener("message", receive);
    window.addEventListener("beforeunload", beforeUnload);
    void getClassicWorkspace(token)
      .then((result) => {
        if (cancelled) return;
        snapshot.current = result;
        latest.current = result.workspace;
        setLoaded(true);
        setStatus("Saved to your account");
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setError(
            caught instanceof Error
              ? caught.message
              : "Could not open your boards.",
          );
          setStatus("Unable to load boards");
        }
      });
    return () => {
      cancelled = true;
      clearTimeout(timer);
      window.removeEventListener("message", receive);
      window.removeEventListener("beforeunload", beforeUnload);
    };
  }, [token]);

  function backup() {
    if (!latest.current) return;
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(latest.current)], { type: "application/json" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "huddlecanvas-workspace.flowboard";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function leave(destination?: string) {
    setLeaving(true);
    try {
      await flush();
      if (destination) window.location.assign(destination);
      else await onSignOut();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not sign out. Please retry.",
      );
    } finally {
      setLeaving(false);
    }
  }
  return (
    <main className="classic-shell">
      <header className="classic-account">
        <strong>
          HuddleCanvas <small>Hosted Alpha</small>
        </strong>
        <span role="status">{status}</span>
        <span className="classic-email">{identity.email}</span>
        <button disabled={leaving} onClick={() => void leave("/?editor=alpha")}>
          Earlier alpha boards
        </button>
        <button disabled={leaving} onClick={() => void leave()}>
          Sign out
        </button>
      </header>
      {error && (
        <div className="classic-error" role="alert">
          <span>{error}</span>
          {latest.current && <button onClick={backup}>Download backup</button>}
          {loaded && !blocked.current && (
            <button onClick={() => void flush().catch(() => {})}>
              Retry save
            </button>
          )}
          <button
            onClick={() => {
              if (
                !pending.current ||
                window.confirm(
                  "Unsaved changes will be lost. Download a backup first. Reload?",
                )
              )
                window.location.reload();
            }}
          >
            Reload cloud copy
          </button>
        </div>
      )}
      {loaded && (
        <iframe
          ref={frame}
          title="HuddleCanvas board"
          src="/v8-hosted.html"
          sandbox="allow-scripts allow-downloads allow-modals"
          allow="fullscreen"
        />
      )}
      {leaving && (
        <div className="classic-leaving" role="status">
          Saving before leaving…
        </div>
      )}
    </main>
  );
}
