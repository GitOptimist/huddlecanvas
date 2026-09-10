import type {
  ActionObject,
  BoardDocument,
  BoardObject,
  ChecklistObject,
  StickyObject,
  TextObject,
} from "@huddlecanvas/board-schema";

function objectStyle(object: BoardObject): React.CSSProperties {
  return {
    left: object.transform.x,
    top: object.transform.y,
    width: object.size.width,
    height: object.size.height,
    transform: `rotate(${object.transform.rotation}deg) scale(${object.transform.scaleX}, ${object.transform.scaleY})`,
  };
}

function Sticky({ object }: { object: StickyObject }) {
  return (
    <article
      className="canvas-object sticky-card"
      style={{ ...objectStyle(object), background: object.color }}
    >
      {object.text}
    </article>
  );
}

function ActionCard({ object }: { object: ActionObject }) {
  return (
    <article className="canvas-object action-card" style={objectStyle(object)}>
      <div className="card-eyebrow">Action</div>
      <strong>{object.title}</strong>
      <div className="action-meta">
        <span className="avatar avatar-small">M</span>
        <span>Due Oct 15</span>
      </div>
      <span className="status-chip status-progress">In progress</span>
    </article>
  );
}

function Checklist({ object }: { object: ChecklistObject }) {
  return (
    <article
      className="canvas-object checklist-card"
      style={objectStyle(object)}
    >
      <div className="card-eyebrow">Checklist</div>
      <strong>{object.title}</strong>
      <div className="checklist-rows">
        {object.rows.map((row) => (
          <div key={row.id} className="checklist-row">
            <span className={row.done ? "check-box checked" : "check-box"}>
              {row.done ? "✓" : ""}
            </span>
            {row.text}
          </div>
        ))}
      </div>
    </article>
  );
}

export function CanvasPreview({ board }: { board: BoardDocument }) {
  const objects = Object.values(board.objects).sort((a, b) =>
    a.orderKey.localeCompare(b.orderKey),
  );
  return (
    <div className="canvas-stage" aria-label="Read-only board model preview">
      <svg className="connector-layer" viewBox="0 0 930 600" aria-hidden="true">
        <defs>
          <marker
            id="arrow"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" />
          </marker>
        </defs>
        <path d="M668 300 C690 325 710 327 720 350" markerEnd="url(#arrow)" />
      </svg>
      {objects.map((object) => {
        if (object.type === "frame")
          return (
            <section
              key={object.id}
              className="canvas-object board-frame"
              style={objectStyle(object)}
            >
              <span>{object.title}</span>
            </section>
          );
        if (object.type === "text")
          return (
            <div
              key={object.id}
              className="canvas-object canvas-heading"
              style={objectStyle(object)}
            >
              {(object as TextObject).text}
            </div>
          );
        if (object.type === "sticky")
          return <Sticky key={object.id} object={object} />;
        if (object.type === "action")
          return <ActionCard key={object.id} object={object} />;
        if (object.type === "checklist")
          return <Checklist key={object.id} object={object} />;
        return null;
      })}
      <div className="lasso-example" aria-hidden="true">
        <span>Lasso selection</span>
      </div>
      <div className="canvas-legend" aria-label="Canvas distinction legend">
        <span>
          <i className="legend-lasso" />
          Temporary selection
        </span>
        <span>
          <i className="legend-frame" />
          Persistent frame
        </span>
      </div>
    </div>
  );
}
