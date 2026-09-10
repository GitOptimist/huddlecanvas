import { CanvasPreview } from "./components/CanvasPreview.tsx";
import { Icon, type IconName } from "./components/Icon.tsx";
import { demoBoard } from "./demoBoard.ts";

const tools: Array<{ name: IconName; label: string }> = [
  { name: "cursor", label: "Select" },
  { name: "hand", label: "Pan" },
  { name: "note", label: "Sticky note" },
  { name: "text", label: "Text" },
  { name: "connector", label: "Connector" },
  { name: "frame", label: "Frame" },
];

export default function App() {
  const objectCount = Object.keys(demoBoard.objects).length;
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            <span />
          </span>
          <span>HuddleCanvas</span>
        </div>
        <div className="workspace-switcher">
          <span className="workspace-avatar">N</span>
          <span>
            <small>Workspace</small>Northstar Studio
          </span>
        </div>
        <nav aria-label="Workspace">
          <span className="nav-item active" aria-current="page">
            <Icon name="board" />
            Boards<span className="nav-count">4</span>
          </span>
          <span className="nav-item">
            <Icon name="clock" />
            Recent
          </span>
          <span className="nav-item">
            <Icon name="grid" />
            Templates
          </span>
        </nav>
        <div className="sidebar-section">
          <span>Boards</span>
          <Icon name="search" size={16} />
        </div>
        <div className="board-list">
          <div className="board-row selected">
            <span className="board-color teal" />
            Q4 Product Planning
          </div>
          <div className="board-row">
            <span className="board-color violet" />
            Research synthesis
          </div>
          <div className="board-row">
            <span className="board-color amber" />
            Team retrospective
          </div>
        </div>
        <div className="sidebar-footer">
          <span className="avatar">AR</span>
          <div>
            <strong>Alex Rivera</strong>
            <small>Owner</small>
          </div>
        </div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div className="title-block">
            <div>
              <span>Boards</span>
              <Icon name="chevron" size={14} />
              <strong>{demoBoard.title}</strong>
            </div>
            <h1>{demoBoard.title}</h1>
          </div>
          <div className="topbar-actions">
            <span className="read-only-badge">
              <span />
              Read-only model proof
            </span>
            <span className="team-scope">
              Role model: Owner · Editor · Viewer
            </span>
          </div>
        </header>

        <div className="content-grid">
          <section className="canvas-panel" id="board">
            <div
              className="canvas-toolbar"
              role="toolbar"
              aria-label="Canvas tools preview"
            >
              {tools.map((tool, index) => (
                <button
                  key={tool.label}
                  className={index === 0 ? "tool-button active" : "tool-button"}
                  disabled
                  title={`${tool.label} — enabled in the interactive canvas milestone`}
                >
                  <Icon name={tool.name} />
                  <span>{tool.label}</span>
                </button>
              ))}
            </div>
            <CanvasPreview board={demoBoard} />
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

          <aside className="inspector" aria-label="Board model inspector">
            <div className="inspector-heading">
              <div className="inspector-icon">
                <Icon name="layers" />
              </div>
              <div>
                <span>Foundation status</span>
                <h2>Model inspector</h2>
              </div>
            </div>
            <p className="inspector-intro">
              This screen renders the canonical board document. Editing,
              accounts, and cloud sync remain intentionally disabled.
            </p>
            <dl className="model-stats">
              <div>
                <dt>Schema</dt>
                <dd>v{demoBoard.schemaVersion}</dd>
              </div>
              <div>
                <dt>Generation</dt>
                <dd>{demoBoard.generation}</dd>
              </div>
              <div>
                <dt>Objects</dt>
                <dd>{objectCount}</dd>
              </div>
              <div>
                <dt>Validation</dt>
                <dd className="success">
                  <Icon name="check" size={15} />
                  Passed
                </dd>
              </div>
            </dl>
            <section className="readiness-card">
              <div>
                <span className="readiness-dot" />
                <strong>v8 import boundary ready</strong>
              </div>
              <p>
                Legacy boards are read without mutation and produce an explicit
                loss report.
              </p>
              <span className="status-chip">Foundation</span>
            </section>
            <div className="inspector-section">
              <h3>Object model</h3>
              <ul className="object-types">
                <li>
                  <span className="type-icon sticky-type" />
                  <span>Sticky notes</span>
                  <strong>3</strong>
                </li>
                <li>
                  <span className="type-icon action-type" />
                  <span>Actions</span>
                  <strong>1</strong>
                </li>
                <li>
                  <span className="type-icon checklist-type" />
                  <span>Checklists</span>
                  <strong>1</strong>
                </li>
                <li>
                  <span className="type-icon frame-type" />
                  <span>Frames</span>
                  <strong>1</strong>
                </li>
                <li>
                  <span className="type-icon connector-type" />
                  <span>Connectors</span>
                  <strong>1</strong>
                </li>
              </ul>
            </div>
            <div className="boundary-note">
              <Icon name="check" size={16} />
              <span>
                <strong>Honest boundary</strong>No simulated collaboration or
                persistence.
              </span>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
