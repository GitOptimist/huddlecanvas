import type {
  BoardDocument,
  BoardObject,
  ID,
} from "@huddlecanvas/board-schema";

export interface Point {
  x: number;
  y: number;
}

export interface Rect extends Point {
  width: number;
  height: number;
}

export type LassoMode = "touch" | "contain";

export function objectCorners(
  object: BoardObject,
): [Point, Point, Point, Point] {
  const width = object.size.width * object.transform.scaleX;
  const height = object.size.height * object.transform.scaleY;
  const centerX = object.transform.x + width / 2;
  const centerY = object.transform.y + height / 2;
  const radians = (object.transform.rotation * Math.PI) / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);

  const rotate = (x: number, y: number): Point => ({
    x: centerX + x * cosine - y * sine,
    y: centerY + x * sine + y * cosine,
  });

  return [
    rotate(-width / 2, -height / 2),
    rotate(width / 2, -height / 2),
    rotate(width / 2, height / 2),
    rotate(-width / 2, height / 2),
  ];
}

export function objectBounds(object: BoardObject): Rect {
  const corners = objectCorners(object);
  const xs = corners.map((point) => point.x);
  const ys = corners.map((point) => point.y);
  const left = Math.min(...xs);
  const top = Math.min(...ys);
  const right = Math.max(...xs);
  const bottom = Math.max(...ys);
  return { x: left, y: top, width: right - left, height: bottom - top };
}

export function rectContains(outer: Rect, inner: Rect): boolean {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.width <= outer.x + outer.width &&
    inner.y + inner.height <= outer.y + outer.height
  );
}

export function rectsIntersect(a: Rect, b: Rect): boolean {
  return !(
    a.x + a.width < b.x ||
    b.x + b.width < a.x ||
    a.y + a.height < b.y ||
    b.y + b.height < a.y
  );
}

export function normalizeRect(start: Point, end: Point): Rect {
  return {
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y),
  };
}

export function selectWithLasso(
  board: BoardDocument,
  lasso: Rect,
  mode: LassoMode = "touch",
): ID[] {
  const predicate = mode === "contain" ? rectContains : rectsIntersect;
  return Object.values(board.objects)
    .filter(
      (object) => !object.hidden && predicate(lasso, objectBounds(object)),
    )
    .sort(
      (a, b) =>
        a.orderKey.localeCompare(b.orderKey) || a.id.localeCompare(b.id),
    )
    .map((object) => object.id);
}

export function expandSelectionToDescendants(
  board: BoardDocument,
  ids: readonly ID[],
): ID[] {
  const expanded = new Set<ID>(ids);
  let changed = true;
  while (changed) {
    changed = false;
    for (const object of Object.values(board.objects)) {
      if (
        object.parentId &&
        expanded.has(object.parentId) &&
        !expanded.has(object.id)
      ) {
        expanded.add(object.id);
        changed = true;
      }
    }
  }
  return [...expanded];
}
