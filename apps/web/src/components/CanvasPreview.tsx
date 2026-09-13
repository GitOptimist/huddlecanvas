import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";

import type {
  ActionObject,
  BoardDocument,
  BoardObject,
  ChecklistObject,
  ShapeKind,
  ShapeObject,
  StickyObject,
  StrokeObject,
  StrokePoint,
  StrokeStyle,
  TextObject,
} from "@huddlecanvas/board-schema";
import { normalizeRect, selectWithLasso } from "@huddlecanvas/canvas-core";

import { Icon, type IconName } from "./Icon.tsx";

export interface CanvasPoint {
  x: number;
  y: number;
}

export type CanvasTool =
  | "select"
  | "hand"
  | "pen"
  | "highlighter"
  | "eraser"
  | "sticky"
  | "text"
  | "shape";

interface CanvasPreviewProps {
  board: BoardDocument;
  canEdit?: boolean;
  selectedObjectIds?: string[];
  onSelectionChange?: (objectIds: string[]) => void;
  onObjectsMove?: (objectIds: string[], dx: number, dy: number) => void;
  onAddSticky?: (point: CanvasPoint) => void;
  onAddText?: (point: CanvasPoint) => void;
  onAddShape?: (point: CanvasPoint, shape: ShapeKind) => void;
  onAddStroke?: (points: StrokePoint[], style: StrokeStyle) => void;
  onEraseStrokes?: (objectIds: string[]) => void;
}

interface ViewportState {
  zoom: number;
  panX: number;
  panY: number;
}

type Gesture =
  | {
      kind: "move";
      objectIds: string[];
      pointerId: number;
      clientX: number;
      clientY: number;
      dx: number;
      dy: number;
    }
  | {
      kind: "lasso";
      pointerId: number;
      start: CanvasPoint;
      end: CanvasPoint;
      additive: boolean;
    }
  | {
      kind: "pan";
      pointerId: number;
      clientX: number;
      clientY: number;
      panX: number;
      panY: number;
    }
  | {
      kind: "draw";
      pointerId: number;
      points: StrokePoint[];
      style: StrokeStyle;
    }
  | { kind: "erase"; pointerId: number };

const WORLD_WIDTH = 2400;
const WORLD_HEIGHT = 1600;
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 2.5;

const primaryTools: Array<{
  id: CanvasTool;
  icon: IconName;
  label: string;
  shortcut: string;
}> = [
  { id: "select", icon: "cursor", label: "Select", shortcut: "V" },
  { id: "hand", icon: "hand", label: "Pan", shortcut: "H" },
  { id: "pen", icon: "pen", label: "Pen", shortcut: "P" },
  {
    id: "highlighter",
    icon: "highlighter",
    label: "Highlighter",
    shortcut: "K",
  },
  { id: "eraser", icon: "eraser", label: "Eraser", shortcut: "E" },
  { id: "sticky", icon: "note", label: "Sticky note", shortcut: "S" },
  { id: "text", icon: "text", label: "Text", shortcut: "T" },
  { id: "shape", icon: "shapes", label: "Shapes", shortcut: "R" },
];

const shapeChoices: Array<{ id: ShapeKind; label: string }> = [
  { id: "rectangle", label: "Rectangle" },
  { id: "rounded-rectangle", label: "Rounded" },
  { id: "ellipse", label: "Ellipse" },
  { id: "triangle", label: "Triangle" },
  { id: "diamond", label: "Diamond" },
  { id: "hexagon", label: "Hexagon" },
  { id: "star", label: "Star" },
  { id: "line", label: "Line" },
];

const inkColors = ["#172033", "#6256d9", "#2563eb", "#dc2626", "#15803d"];

function clampZoom(value: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));
}

function isEditingTarget(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  return Boolean(
    element?.closest("input, textarea, select, [contenteditable='true']"),
  );
}

function objectStyle(object: BoardObject): React.CSSProperties {
  return {
    left: object.transform.x,
    top: object.transform.y,
    width: Math.max(1, object.size.width),
    height: Math.max(1, object.size.height),
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
  const star = Array.from({ length: 10 }, (_, index) => {
    const angle = -Math.PI / 2 + (index * Math.PI) / 5;
    const radius = index % 2 === 0 ? 0.47 : 0.22;
    return `${width / 2 + Math.cos(angle) * width * radius},${height / 2 + Math.sin(angle) * height * radius}`;
  }).join(" ");
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
      ) : object.shape === "hexagon" ? (
        <polygon
          points={`${width * 0.25},2 ${width * 0.75},2 ${width - 2},${height / 2} ${width * 0.75},${height - 2} ${width * 0.25},${height - 2} 2,${height / 2}`}
          {...common}
        />
      ) : object.shape === "star" ? (
        <polygon points={star} {...common} />
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

function Stroke({ object }: { object: StrokeObject }) {
  return (
    <svg
      className="object-surface stroke-object"
      viewBox={`0 0 ${Math.max(1, object.size.width)} ${Math.max(1, object.size.height)}`}
      aria-hidden="true"
    >
      <polyline
        points={object.points.map((point) => `${point.x},${point.y}`).join(" ")}
        fill="none"
        stroke={object.style.color}
        strokeWidth={object.style.width}
        strokeOpacity={object.style.opacity}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function distanceToSegment(
  point: CanvasPoint,
  start: CanvasPoint,
  end: CanvasPoint,
): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (dx === 0 && dy === 0)
    return Math.hypot(point.x - start.x, point.y - start.y);
  const t = Math.max(
    0,
    Math.min(
      1,
      ((point.x - start.x) * dx + (point.y - start.y) * dy) /
        (dx * dx + dy * dy),
    ),
  );
  return Math.hypot(point.x - (start.x + t * dx), point.y - (start.y + t * dy));
}

function strokeAtPoint(
  objects: BoardObject[],
  point: CanvasPoint,
  tolerance: number,
): StrokeObject | null {
  for (const candidate of [...objects].reverse()) {
    if (candidate.type !== "stroke" || candidate.hidden) continue;
    const points = candidate.points.map((strokePoint) => ({
      x: candidate.transform.x + strokePoint.x,
      y: candidate.transform.y + strokePoint.y,
    }));
    for (let index = 1; index < points.length; index += 1) {
      if (
        distanceToSegment(point, points[index - 1]!, points[index]!) <=
        tolerance + candidate.style.width / 2
      ) {
        return candidate;
      }
    }
  }
  return null;
}

export function CanvasPreview({
  board,
  canEdit = false,
  selectedObjectIds = [],
  onSelectionChange,
  onObjectsMove,
  onAddSticky,
  onAddText,
  onAddShape,
  onAddStroke,
  onEraseStrokes,
}: CanvasPreviewProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const gesture = useRef<Gesture | null>(null);
  const erasedDuringGesture = useRef(new Set<string>());
  const [tool, setTool] = useState<CanvasTool>("select");
  const [shape, setShape] = useState<ShapeKind>("rectangle");
  const [inkColor, setInkColor] = useState("#172033");
  const [spacePanning, setSpacePanning] = useState(false);
  const [dragPreview, setDragPreview] = useState<{
    ids: string[];
    dx: number;
    dy: number;
  } | null>(null);
  const [lassoPreview, setLassoPreview] = useState<{
    start: CanvasPoint;
    end: CanvasPoint;
  } | null>(null);
  const [erasedPreview, setErasedPreview] = useState<string[]>([]);
  const [draftStroke, setDraftStroke] = useState<{
    points: StrokePoint[];
    style: StrokeStyle;
  } | null>(null);
  const [viewport, setViewport] = useState<ViewportState>({
    zoom: 1,
    panX: 0,
    panY: 0,
  });

  const objects = Object.values(board.objects).sort((a, b) =>
    a.orderKey.localeCompare(b.orderKey),
  );
  const visibleObjects = objects.filter((object) => !object.hidden);
  const effectiveTool = spacePanning ? "hand" : tool;

  useEffect(() => {
    function keyDown(event: KeyboardEvent) {
      if (isEditingTarget(event.target)) return;
      if (event.code === "Space") {
        event.preventDefault();
        setSpacePanning(true);
        return;
      }
      const shortcut: Record<string, CanvasTool> = {
        v: "select",
        h: "hand",
        p: "pen",
        k: "highlighter",
        e: "eraser",
        s: "sticky",
        t: "text",
        r: "shape",
      };
      if (event.key === "Escape") {
        setTool("select");
        onSelectionChange?.([]);
      }
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const next = shortcut[event.key.toLowerCase()];
      if (next && (canEdit || next === "select" || next === "hand")) {
        event.preventDefault();
        setTool(next);
      }
    }
    function keyUp(event: KeyboardEvent) {
      if (event.code === "Space") setSpacePanning(false);
    }
    window.addEventListener("keydown", keyDown);
    window.addEventListener("keyup", keyUp);
    return () => {
      window.removeEventListener("keydown", keyDown);
      window.removeEventListener("keyup", keyUp);
    };
  }, [canEdit, onSelectionChange]);

  function canvasPoint(clientX: number, clientY: number): CanvasPoint {
    const bounds = viewportRef.current?.getBoundingClientRect();
    if (!bounds) return { x: 0, y: 0 };
    return {
      x: (clientX - bounds.left - viewport.panX) / viewport.zoom,
      y: (clientY - bounds.top - viewport.panY) / viewport.zoom,
    };
  }

  function zoomAt(clientX: number, clientY: number, nextZoom: number) {
    const bounds = viewportRef.current?.getBoundingClientRect();
    if (!bounds) return;
    setViewport((current) => {
      const zoom = clampZoom(nextZoom);
      const localX = clientX - bounds.left;
      const localY = clientY - bounds.top;
      const boardX = (localX - current.panX) / current.zoom;
      const boardY = (localY - current.panY) / current.zoom;
      return {
        zoom,
        panX: localX - boardX * zoom,
        panY: localY - boardY * zoom,
      };
    });
  }

  function zoomFromCenter(multiplier: number) {
    const bounds = viewportRef.current?.getBoundingClientRect();
    if (!bounds) return;
    zoomAt(
      bounds.left + bounds.width / 2,
      bounds.top + bounds.height / 2,
      viewport.zoom * multiplier,
    );
  }

  function fitContent() {
    const bounds = viewportRef.current?.getBoundingClientRect();
    if (!bounds || visibleObjects.length === 0) {
      setViewport({ zoom: 1, panX: 0, panY: 0 });
      return;
    }
    const left = Math.min(
      ...visibleObjects.map((object) => object.transform.x),
    );
    const top = Math.min(...visibleObjects.map((object) => object.transform.y));
    const right = Math.max(
      ...visibleObjects.map(
        (object) => object.transform.x + Math.max(1, object.size.width),
      ),
    );
    const bottom = Math.max(
      ...visibleObjects.map(
        (object) => object.transform.y + Math.max(1, object.size.height),
      ),
    );
    const padding = 120;
    const width = Math.max(1, right - left);
    const height = Math.max(1, bottom - top);
    const zoom = clampZoom(
      Math.min(
        (bounds.width - padding * 2) / width,
        (bounds.height - padding * 2) / height,
      ),
    );
    setViewport({
      zoom,
      panX: (bounds.width - width * zoom) / 2 - left * zoom,
      panY: (bounds.height - height * zoom) / 2 - top * zoom,
    });
  }

  function wheel(event: ReactWheelEvent<HTMLDivElement>) {
    if (
      (event.target as HTMLElement).closest(
        ".canvas-toolbar, .ink-palette, .zoom-control, .selection-actions",
      )
    )
      return;
    event.preventDefault();
    zoomAt(
      event.clientX,
      event.clientY,
      viewport.zoom * Math.exp(-event.deltaY * 0.0015),
    );
  }

  function eraseAt(point: CanvasPoint) {
    if (!onEraseStrokes) return;
    const target = strokeAtPoint(objects, point, 9 / viewport.zoom);
    if (!target || erasedDuringGesture.current.has(target.id)) return;
    erasedDuringGesture.current.add(target.id);
    setErasedPreview([...erasedDuringGesture.current]);
  }

  function pointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (
      (event.target as HTMLElement).closest(
        ".canvas-toolbar, .ink-palette, .zoom-control, .canvas-mode-hint, .selection-actions",
      )
    ) {
      return;
    }
    const shouldPan =
      effectiveTool === "hand" || event.button === 1 || event.button === 2;
    if (shouldPan) {
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      gesture.current = {
        kind: "pan",
        pointerId: event.pointerId,
        clientX: event.clientX,
        clientY: event.clientY,
        panX: viewport.panX,
        panY: viewport.panY,
      };
      return;
    }
    if (event.button !== 0) return;
    const point = canvasPoint(event.clientX, event.clientY);
    if (effectiveTool === "pen" || effectiveTool === "highlighter") {
      if (!canEdit || !onAddStroke) return;
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      const style: StrokeStyle =
        effectiveTool === "highlighter"
          ? { color: inkColor, width: 18, opacity: 0.28 }
          : { color: inkColor, width: 3, opacity: 1 };
      const points: StrokePoint[] = [
        {
          ...point,
          ...(event.pressure ? { pressure: event.pressure } : {}),
          time: Date.now(),
        },
      ];
      gesture.current = {
        kind: "draw",
        pointerId: event.pointerId,
        points,
        style,
      };
      setDraftStroke({ points, style });
      return;
    }
    if (effectiveTool === "eraser") {
      if (!canEdit) return;
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      erasedDuringGesture.current.clear();
      gesture.current = { kind: "erase", pointerId: event.pointerId };
      eraseAt(point);
      return;
    }
    if (!canEdit) return;
    if (effectiveTool === "sticky") {
      onAddSticky?.(point);
      setTool("select");
    } else if (effectiveTool === "text") {
      onAddText?.(point);
      setTool("select");
    } else if (effectiveTool === "shape") {
      onAddShape?.(point, shape);
      setTool("select");
    } else {
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      gesture.current = {
        kind: "lasso",
        pointerId: event.pointerId,
        start: point,
        end: point,
        additive: event.shiftKey,
      };
      setLassoPreview({ start: point, end: point });
    }
  }

  function pointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const current = gesture.current;
    if (!current || current.pointerId !== event.pointerId) return;
    if (current.kind === "pan") {
      setViewport((view) => ({
        ...view,
        panX: current.panX + event.clientX - current.clientX,
        panY: current.panY + event.clientY - current.clientY,
      }));
      return;
    }
    if (current.kind === "move") {
      current.dx = (event.clientX - current.clientX) / viewport.zoom;
      current.dy = (event.clientY - current.clientY) / viewport.zoom;
      setDragPreview({
        ids: current.objectIds,
        dx: current.dx,
        dy: current.dy,
      });
      return;
    }
    if (current.kind === "lasso") {
      current.end = canvasPoint(event.clientX, event.clientY);
      setLassoPreview({ start: current.start, end: current.end });
      return;
    }
    if (current.kind === "erase") {
      eraseAt(canvasPoint(event.clientX, event.clientY));
      return;
    }
    if (current.kind === "draw") {
      const nativeEvent = event.nativeEvent;
      const samples = nativeEvent.getCoalescedEvents?.() ?? [nativeEvent];
      for (const sample of samples) {
        const point = canvasPoint(sample.clientX, sample.clientY);
        const previous = current.points.at(-1);
        if (
          previous &&
          Math.hypot(point.x - previous.x, point.y - previous.y) < 0.6
        ) {
          continue;
        }
        current.points.push({
          ...point,
          ...(sample.pressure ? { pressure: sample.pressure } : {}),
          time: Date.now(),
        });
      }
      setDraftStroke({ points: [...current.points], style: current.style });
    }
  }

  function pointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    const current = gesture.current;
    if (!current || current.pointerId !== event.pointerId) return;
    if (current.kind === "draw" && current.points.length > 1) {
      onAddStroke?.(current.points, current.style);
    }
    if (current.kind === "erase" && erasedDuringGesture.current.size) {
      onEraseStrokes?.([...erasedDuringGesture.current]);
    }
    if (current.kind === "move") {
      onObjectsMove?.(current.objectIds, current.dx, current.dy);
      setDragPreview(null);
    }
    if (current.kind === "lasso") {
      const end = canvasPoint(event.clientX, event.clientY);
      const rect = normalizeRect(current.start, end);
      const hits =
        rect.width < 3 / viewport.zoom && rect.height < 3 / viewport.zoom
          ? []
          : selectWithLasso(board, rect);
      onSelectionChange?.(
        current.additive ? [...new Set([...selectedObjectIds, ...hits])] : hits,
      );
      setLassoPreview(null);
    }
    gesture.current = null;
    erasedDuringGesture.current.clear();
    setErasedPreview([]);
    setDraftStroke(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function pointerCancel(event: ReactPointerEvent<HTMLDivElement>) {
    if (gesture.current?.pointerId !== event.pointerId) return;
    gesture.current = null;
    erasedDuringGesture.current.clear();
    setErasedPreview([]);
    setDraftStroke(null);
    setDragPreview(null);
    setLassoPreview(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function objectPointerDown(
    event: ReactPointerEvent<HTMLDivElement>,
    object: BoardObject,
  ) {
    if (effectiveTool !== "select") return;
    event.stopPropagation();
    if (event.shiftKey) {
      onSelectionChange?.(
        selectedObjectIds.includes(object.id)
          ? selectedObjectIds.filter((id) => id !== object.id)
          : [...selectedObjectIds, object.id],
      );
      return;
    }
    const ids = selectedObjectIds.includes(object.id)
      ? selectedObjectIds
      : [object.id];
    onSelectionChange?.(ids);
    if (!onObjectsMove || object.locked || event.button !== 0) return;
    event.preventDefault();
    viewportRef.current?.setPointerCapture(event.pointerId);
    gesture.current = {
      kind: "move",
      objectIds: ids.filter((id) => !board.objects[id]?.locked),
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      dx: 0,
      dy: 0,
    };
  }

  function renderObject(object: BoardObject) {
    if (object.type === "stroke") return <Stroke object={object} />;
    if (object.type === "frame") {
      return (
        <section className="object-surface board-frame">
          <span>{object.title}</span>
        </section>
      );
    }
    if (object.type === "text") {
      const text = object as TextObject;
      return (
        <div
          className="object-surface canvas-heading"
          style={{
            color: text.style.color,
            fontFamily: text.style.fontFamily,
            fontSize: text.style.fontSize,
            fontWeight: text.style.fontWeight,
            textAlign: text.style.textAlign,
          }}
        >
          {text.text}
        </div>
      );
    }
    if (object.type === "sticky") return <Sticky object={object} />;
    if (object.type === "action") return <ActionCard object={object} />;
    if (object.type === "checklist") return <Checklist object={object} />;
    if (object.type === "shape") return <Shape object={object} />;
    return null;
  }

  const cursorClass = `canvas-tool-${effectiveTool}`;
  const modeLabel =
    effectiveTool === "select"
      ? "Select and move objects"
      : effectiveTool === "hand"
        ? "Drag to pan the board"
        : effectiveTool === "eraser"
          ? "Drag across ink to erase"
          : effectiveTool === "shape"
            ? `Click to place a ${shape.replace("-", " ")}`
            : effectiveTool === "sticky" || effectiveTool === "text"
              ? "Click the board to place it"
              : "Draw directly on the board";

  return (
    <div
      ref={viewportRef}
      className={`canvas-stage hosted-canvas-stage ${cursorClass}`}
      aria-label="Canvas"
      onContextMenu={(event) => event.preventDefault()}
      onWheel={wheel}
      onPointerDown={pointerDown}
      onPointerMove={pointerMove}
      onPointerUp={pointerUp}
      onPointerCancel={pointerCancel}
    >
      <div className="canvas-toolbar" role="toolbar" aria-label="Canvas tools">
        {primaryTools.map((item, index) => (
          <button
            key={item.id}
            className={tool === item.id ? "tool-button active" : "tool-button"}
            disabled={index > 1 && !canEdit}
            title={`${item.label} (${item.shortcut})`}
            aria-label={`${item.label} (${item.shortcut})`}
            aria-pressed={tool === item.id}
            onClick={() => setTool(item.id)}
          >
            <Icon name={item.icon} />
          </button>
        ))}
        {tool === "shape" && canEdit ? (
          <div
            className="tool-options shape-options"
            aria-label="Shape choices"
          >
            {shapeChoices.map((choice) => (
              <button
                key={choice.id}
                className={shape === choice.id ? "selected" : ""}
                aria-pressed={shape === choice.id}
                onClick={() => setShape(choice.id)}
              >
                {choice.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {(tool === "pen" || tool === "highlighter") && canEdit ? (
        <div className="ink-palette" role="group" aria-label="Ink colors">
          <span>{tool === "pen" ? "Pen" : "Highlighter"}</span>
          {inkColors.map((color) => (
            <button
              key={color}
              type="button"
              className={inkColor === color ? "selected" : ""}
              style={{ backgroundColor: color }}
              aria-label={`Use ink color ${color}`}
              aria-pressed={inkColor === color}
              onClick={() => setInkColor(color)}
            />
          ))}
        </div>
      ) : null}

      <div
        className="canvas-world"
        style={{
          width: WORLD_WIDTH,
          height: WORLD_HEIGHT,
          transform: `translate(${viewport.panX}px, ${viewport.panY}px) scale(${viewport.zoom})`,
          backgroundColor: board.settings.background.color,
          backgroundImage:
            board.settings.background.kind === "grid"
              ? "linear-gradient(#e8edf2 1px, transparent 1px), linear-gradient(90deg, #e8edf2 1px, transparent 1px)"
              : board.settings.background.kind === "dots"
                ? "radial-gradient(circle, #d8dee6 1.2px, transparent 1.3px)"
                : "none",
          backgroundSize: `${board.settings.snap.gridSize}px ${board.settings.snap.gridSize}px`,
        }}
      >
        {visibleObjects.length === 0 ? (
          <div className="canvas-empty-prompt">
            <strong>Start anywhere.</strong>
            <span>Choose a tool on the left to add to this board.</span>
          </div>
        ) : null}
        {objects.map((object) => {
          const rendered = renderObject(object);
          if (!rendered || object.hidden || erasedPreview.includes(object.id))
            return null;
          return (
            <div
              key={object.id}
              className={`canvas-object hosted-object${selectedObjectIds.includes(object.id) ? " selected" : ""}${effectiveTool === "select" && onObjectsMove && !object.locked ? " movable" : ""}`}
              style={{
                ...objectStyle(object),
                ...(dragPreview?.ids.includes(object.id)
                  ? {
                      left: object.transform.x + dragPreview.dx,
                      top: object.transform.y + dragPreview.dy,
                    }
                  : {}),
              }}
              tabIndex={effectiveTool === "select" ? 0 : -1}
              role="button"
              aria-label={`${object.type} object${object.locked ? ", locked" : ""}`}
              onPointerDown={(event) => objectPointerDown(event, object)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelectionChange?.([object.id]);
                }
              }}
            >
              {rendered}
            </div>
          );
        })}
        {lassoPreview ? (
          <div
            className="canvas-lasso"
            style={normalizeRect(lassoPreview.start, lassoPreview.end)}
            aria-hidden="true"
          />
        ) : null}
        {draftStroke ? (
          <svg
            className="draft-stroke-layer"
            width={WORLD_WIDTH}
            height={WORLD_HEIGHT}
            viewBox={`0 0 ${WORLD_WIDTH} ${WORLD_HEIGHT}`}
            aria-hidden="true"
          >
            <polyline
              points={draftStroke.points
                .map((point) => `${point.x},${point.y}`)
                .join(" ")}
              fill="none"
              stroke={draftStroke.style.color}
              strokeWidth={draftStroke.style.width}
              strokeOpacity={draftStroke.style.opacity}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : null}
      </div>

      <div className="canvas-mode-hint" role="status">
        <Icon
          name={
            primaryTools.find((candidate) => candidate.id === effectiveTool)
              ?.icon ?? "cursor"
          }
          size={14}
        />
        {modeLabel}
      </div>

      <div className="zoom-control" aria-label="Canvas zoom controls">
        <button onClick={() => zoomFromCenter(0.85)} aria-label="Zoom out">
          −
        </button>
        <button
          className="zoom-value"
          onClick={() => setViewport({ zoom: 1, panX: 0, panY: 0 })}
          aria-label="Reset zoom and position"
        >
          {Math.round(viewport.zoom * 100)}%
        </button>
        <button onClick={() => zoomFromCenter(1.15)} aria-label="Zoom in">
          +
        </button>
        <button
          onClick={fitContent}
          aria-label="Fit board content"
          title="Fit content"
        >
          <Icon name="fit" size={15} />
        </button>
      </div>
    </div>
  );
}
