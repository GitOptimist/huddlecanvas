import { useRef, type PointerEvent as ReactPointerEvent } from "react";

import type {
  ActionObject,
  BoardDocument,
  BoardObject,
  ChecklistObject,
  ShapeObject,
  StickyObject,
  TextObject,
} from "@huddlecanvas/board-schema";

interface CanvasPreviewProps {
  board: BoardDocument;
  selectedObjectId?: string | null;
  onSelect?: (objectId: string | null) => void;
  onObjectMove?: (objectId: string, x: number, y: number) => void;
}

interface DragState {
  objectId: string;
  pointerId: number;
  clientX: number;
  clientY: number;
  originX: number;
  originY: number;
}

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
      className="object-surface sticky-card"
      style={{ background: object.color }}
    >
      {object.text}
    </article>
  );
}

function ActionCard({ object }: { object: ActionObject }) {
  return (
    <article className="object-surface action-card">
      <div className="card-eyebrow">Action</div>
      <strong>{object.title}</strong>
      <div className="action-meta">
        <span className="avatar avatar-small">A</span>
        <span>
          {object.dueAt
            ? new Date(object.dueAt).toLocaleDateString()
            : "No due date"}
        </span>
      </div>
      <span className="status-chip status-progress">
        {object.status.replace("-", " ")}
      </span>
    </article>
  );
}

function Checklist({ object }: { object: ChecklistObject }) {
  return (
    <article className="object-surface checklist-card">
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

function Shape({ object }: { object: ShapeObject }) {
  const width = Math.max(1, object.size.width);
  const height = Math.max(1, object.size.height);
  const common = {
    fill: object.style.fill ?? "transparent",
    stroke: object.style.stroke,
    strokeWidth: object.style.strokeWidth,
    opacity: object.style.opacity,
    vectorEffect: "non-scaling-stroke" as const,
  };
  return (
    <svg
      className="object-surface shape-object"
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
    >
      {object.shape === "ellipse" ? (
        <ellipse
          cx={width / 2}
          cy={height / 2}
          rx={width / 2 - 2}
          ry={height / 2 - 2}
          {...common}
        />
      ) : object.shape === "line" ? (
        <line x1="2" y1="2" x2={width - 2} y2={height - 2} {...common} />
      ) : object.shape === "diamond" ? (
        <polygon
          points={`${width / 2},2 ${width - 2},${height / 2} ${width / 2},${height - 2} 2,${height / 2}`}
          {...common}
        />
      ) : object.shape === "triangle" ? (
        <polygon
          points={`${width / 2},2 ${width - 2},${height - 2} 2,${height - 2}`}
          {...common}
        />
      ) : (
        <rect
          x="2"
          y="2"
          width={width - 4}
          height={height - 4}
          rx={object.shape === "rounded-rectangle" ? 14 : 2}
          {...common}
        />
      )}
    </svg>
  );
}

export function CanvasPreview({
  board,
  selectedObjectId = null,
  onSelect,
  onObjectMove,
}: CanvasPreviewProps) {
  const drag = useRef<DragState | null>(null);
  const objects = Object.values(board.objects).sort((a, b) =>
    a.orderKey.localeCompare(b.orderKey),
  );

  function pointerDown(
    event: ReactPointerEvent<HTMLElement>,
    object: BoardObject,
  ) {
    event.stopPropagation();
    onSelect?.(object.id);
    if (!onObjectMove || object.locked || event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      objectId: object.id,
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      originX: object.transform.x,
      originY: object.transform.y,
    };
  }

  function pointerMove(event: ReactPointerEvent<HTMLElement>) {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId || !onObjectMove)
      return;
    onObjectMove(
      current.objectId,
      current.originX + event.clientX - current.clientX,
      current.originY + event.clientY - current.clientY,
    );
  }

  function pointerUp(event: ReactPointerEvent<HTMLElement>) {
    if (drag.current?.pointerId === event.pointerId) drag.current = null;
  }

  function renderObject(object: BoardObject) {
    if (object.type === "frame") {
      return (
        <section className="object-surface board-frame">
          <span>{object.title}</span>
        </section>
      );
    }
    if (object.type === "text") {
      return (
        <div className="object-surface canvas-heading">
          {(object as TextObject).text}
        </div>
      );
    }
    if (object.type === "sticky") return <Sticky object={object} />;
    if (object.type === "action") return <ActionCard object={object} />;
    if (object.type === "checklist") return <Checklist object={object} />;
    if (object.type === "shape") return <Shape object={object} />;
    return null;
  }

  return (
    <div
      className="canvas-stage hosted-canvas-stage"
      aria-label="Editable hosted board"
      onPointerDown={() => onSelect?.(null)}
    >
      {objects.map((object) => {
        const rendered = renderObject(object);
        if (!rendered || object.hidden) return null;
        return (
          <div
            key={object.id}
            className={`canvas-object hosted-object${selectedObjectId === object.id ? " selected" : ""}${onObjectMove && !object.locked ? " movable" : ""}`}
            style={objectStyle(object)}
            tabIndex={0}
            role="button"
            aria-label={`${object.type} object${object.locked ? ", locked" : ""}`}
            onPointerDown={(event) => pointerDown(event, object)}
            onPointerMove={pointerMove}
            onPointerUp={pointerUp}
            onPointerCancel={pointerUp}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onSelect?.(object.id);
              }
            }}
          >
            {rendered}
          </div>
        );
      })}
      <div className="canvas-legend hosted-legend">
        <span>
          <i className="legend-selected" /> Selected object
        </span>
        <span>
          <i className="legend-durable" /> Autosaved revision
        </span>
      </div>
    </div>
  );
}
